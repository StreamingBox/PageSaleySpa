import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CircleDot, MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import CollectionToolbar from '../components/CollectionToolbar';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import DrawerForm from '../components/DrawerForm';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import KpiCard from '../components/KpiCard';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';
import { applyVisibleLimit, compareDate, compareNumber, compareText } from '../lib/collections';

const emptyConversation = { title: '', owner_name: '', channel: 'chatgpt', status: 'pendiente', priority: 'media', objective: '', summary: '', last_message: '', next_action: '', unread_count: '0', last_activity_at: '' };
const sortOptions = [{ value: 'score-desc', label: 'Prioridad del agente' }, { value: 'activity-desc', label: 'Actividad reciente' }, { value: 'activity-asc', label: 'Mas antiguas primero' }, { value: 'priority-desc', label: 'Prioridad alta primero' }, { value: 'title-asc', label: 'Titulo A-Z' }];
const channelOptions = [{ value: '', label: 'Todos los canales' }, { value: 'chatgpt', label: 'ChatGPT' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'instagram', label: 'Instagram' }, { value: 'email', label: 'Email' }, { value: 'telefono', label: 'Telefono' }, { value: 'otro', label: 'Otro' }];
const statusOptions = [{ value: '', label: 'Todos los estados' }, { value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En progreso' }, { value: 'en_espera', label: 'En espera' }, { value: 'bloqueada', label: 'Bloqueada' }, { value: 'resuelta', label: 'Resuelta' }];
const priorityOptions = [{ value: '', label: 'Todas las prioridades' }, { value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' }];

function formatDateTime(value) {
    if (!value) return 'Sin actividad';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin actividad';
    return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
}

function toDateTimeLocalValue(value) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const offset = parsed.getTimezoneOffset();
    return new Date(parsed.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function getPriorityRank(priority) {
    switch (priority) {
        case 'alta': return 3;
        case 'media': return 2;
        default: return 1;
    }
}

function sortThreads(rows, sortValue) {
    const sorted = [...rows];
    switch (sortValue) {
        case 'activity-asc': return sorted.sort((l, r) => compareDate(l.last_activity_at, r.last_activity_at));
        case 'activity-desc': return sorted.sort((l, r) => compareDate(r.last_activity_at, l.last_activity_at));
        case 'priority-desc': return sorted.sort((l, r) => getPriorityRank(r.priority) - getPriorityRank(l.priority));
        case 'title-asc': return sorted.sort((l, r) => compareText(l.title, r.title));
        case 'score-desc':
        default:
            return sorted.sort((l, r) => {
                const byScore = compareNumber(r.manager_score, l.manager_score);
                return byScore || compareDate(r.last_activity_at, l.last_activity_at);
            });
    }
}

const getStatusLabel = status => statusOptions.find(option => option.value === status)?.label || status;
const getPriorityLabel = priority => priorityOptions.find(option => option.value === priority)?.label || priority;
const getChannelLabel = channel => channelOptions.find(option => option.value === channel)?.label || channel;

function normalizeFormPayload(form) {
    return { ...form, unread_count: Number(form.unread_count || 0), last_activity_at: form.last_activity_at ? new Date(form.last_activity_at).toISOString() : new Date().toISOString() };
}

export default function ConversationsAdminPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [draftSearch, setDraftSearch] = useState(searchParams.get('search') || '');
    const [visibleLimit, setVisibleLimit] = useState('10');
    const [sortValue, setSortValue] = useState('score-desc');
    const [form, setForm] = useState(emptyConversation);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const newMatch = useMatch('/conversations/new');
    const editMatch = useMatch('/conversations/:id/edit');
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { showToast } = useToast();

    const listQuery = useQuery({ queryKey: ['conversation-threads', location.search], queryFn: () => apiFetch(`/api/conversation-threads${location.search}`) });
    const summaryQuery = useQuery({ queryKey: ['conversation-threads', 'summary'], queryFn: () => apiFetch('/api/conversation-threads/summary') });
    const editQuery = useQuery({ queryKey: ['conversation-thread', editMatch?.params.id], enabled: Boolean(editMatch?.params.id), queryFn: () => apiFetch(`/api/conversation-threads/${editMatch.params.id}`) });

    useEffect(() => { setDraftSearch(searchParams.get('search') || ''); }, [searchParams]);
    useEffect(() => {
        if (newMatch) {
            setForm({ ...emptyConversation, last_activity_at: toDateTimeLocalValue(new Date().toISOString()) });
            return;
        }
        if (editQuery.data?.data) {
            const thread = editQuery.data.data;
            setForm({ title: thread.title || '', owner_name: thread.owner_name || '', channel: thread.channel || 'chatgpt', status: thread.status || 'pendiente', priority: thread.priority || 'media', objective: thread.objective || '', summary: thread.summary || '', last_message: thread.last_message || '', next_action: thread.next_action || '', unread_count: String(thread.unread_count || 0), last_activity_at: toDateTimeLocalValue(thread.last_activity_at) });
        }
    }, [newMatch, editQuery.data]);

    const sortedThreads = useMemo(() => sortThreads(listQuery.data?.data || [], sortValue), [listQuery.data?.data, sortValue]);
    const visibleThreads = useMemo(() => applyVisibleLimit(sortedThreads, visibleLimit), [sortedThreads, visibleLimit]);

    const saveMutation = useMutation({
        mutationFn: values => apiFetch(editMatch ? `/api/conversation-threads/${editMatch.params.id}` : '/api/conversation-threads', { method: editMatch ? 'PUT' : 'POST', body: normalizeFormPayload(values) }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['conversation-threads'] });
            await queryClient.invalidateQueries({ queryKey: ['conversation-thread'] });
            showToast(editMatch ? 'Conversacion actualizada' : 'Conversacion registrada', 'success');
            navigate(`/conversations${location.search}`);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const deleteMutation = useMutation({
        mutationFn: id => apiFetch(`/api/conversation-threads/${id}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['conversation-threads'] });
            await queryClient.invalidateQueries({ queryKey: ['conversation-thread'] });
            showToast('Conversacion eliminada', 'success');
            setDeleteTarget(null);
        },
        onError: error => showToast(error.message, 'danger')
    });

    const columns = [
        { key: 'title', label: 'Conversacion', render: row => <div className="conversation-cell"><div className="conversation-cell__title"><strong>{row.title}</strong><span>{row.owner_name || 'Sin responsable'} · {getChannelLabel(row.channel)}</span></div>{row.objective ? <p className="conversation-cell__objective">{row.objective}</p> : null}</div> },
        { key: 'health', label: 'Estado', render: row => <div className="conversation-badges"><span className={`conversation-pill conversation-pill--${row.status}`}>{getStatusLabel(row.status)}</span><span className={`conversation-pill conversation-pill--priority-${row.priority}`}>{getPriorityLabel(row.priority)}</span><span className="conversation-pill conversation-pill--neutral">{row.unread_count} sin leer</span></div> },
        { key: 'manager_note', label: 'Decision del agente', render: row => <div className="conversation-agent-note"><strong>Score {row.manager_score}</strong><p>{row.manager_note}</p></div> },
        { key: 'last_activity_at', label: 'Ultima actividad', render: row => <span className="conversation-activity">{formatDateTime(row.last_activity_at)}</span> },
        { key: 'actions', label: 'Acciones', align: 'right', render: row => <div className="table-action-group"><button className="table-action" onClick={() => navigate(`/conversations/${row.id}/edit${location.search}`)} type="button"><Pencil size={14} />Editar</button><button className="table-action table-action--danger" onClick={() => setDeleteTarget(row)} type="button"><Trash2 size={14} />Eliminar</button></div> }
    ];

    const submitSearch = event => {
        event.preventDefault();
        const nextParams = new URLSearchParams(searchParams);
        if (draftSearch) nextParams.set('search', draftSearch);
        else nextParams.delete('search');
        setSearchParams(nextParams);
    };

    const setFilterValue = (key, value) => {
        const nextParams = new URLSearchParams(searchParams);
        if (value) nextParams.set(key, value);
        else nextParams.delete(key);
        setSearchParams(nextParams);
    };

    const summary = summaryQuery.data?.data;
    const isDrawerOpen = Boolean(newMatch || editMatch);

    return (
        <div className="page-stack">
            <section className="hero hero--conversations">
                <div className="hero__text">
                    <p className="hero__eyebrow">Agente administrador</p>
                    <h3>Orquesta tus otras conversaciones desde un solo tablero</h3>
                    <p>Centraliza hilos, define prioridad, registra contexto y deja que el agente te marque el siguiente movimiento recomendado.</p>
                </div>
                <div className="hero__actions">
                    <button className="button button--primary" onClick={() => navigate('/conversations/new')} type="button"><Plus size={16} />Nueva conversacion</button>
                </div>
            </section>

            <section className="kpi-grid">
                <KpiCard label="Conversaciones activas" value={summary?.total ?? '0'} note="Inventario total del tablero del agente." />
                <KpiCard label="Prioridad alta" value={summary?.urgent ?? '0'} note="Hilos que deberian atenderse primero." accent="warning" />
                <KpiCard label="Bloqueadas" value={summary?.blocked ?? '0'} note="Conversaciones detenidas por falta de accion o respuesta." accent="danger" />
                <KpiCard label="Esperan respuesta" value={summary?.waitingReply ?? '0'} note="Mensajes no leidos o pendientes de contestar." accent="cyan" />
            </section>

            <section className="conversations-grid">
                <article className="panel conversations-panel">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Foco inmediato</p>
                            <h3>Recomendaciones del agente</h3>
                        </div>
                        <div className="conversation-insight"><CircleDot size={14} />{summary?.stale ?? 0} con seguimiento atrasado</div>
                    </div>
                    {summaryQuery.isLoading ? <p>Cargando recomendaciones...</p> : summaryQuery.isError ? <p>{summaryQuery.error.message}</p> : summary?.recommendations?.length ? <div className="conversation-recommendation-list">{summary.recommendations.map(thread => <article className="conversation-recommendation" key={thread.id}><div className="conversation-recommendation__icon"><Bot size={18} /></div><div className="conversation-recommendation__copy"><strong>{thread.title}</strong><span>{thread.owner_name || 'Sin responsable'} · {getPriorityLabel(thread.priority)} · {getStatusLabel(thread.status)}</span><p>{thread.manager_note}</p></div><button className="button button--ghost" onClick={() => navigate(`/conversations/${thread.id}/edit${location.search}`)} type="button">Abrir</button></article>)}</div> : <EmptyState title="Todavia no hay conversaciones" description="Crea el primer hilo y el agente empezara a priorizarlo." action={<button className="button button--primary" onClick={() => navigate('/conversations/new')} type="button">Crear conversacion</button>} />}
                </article>

                <article className="panel conversations-panel conversations-panel--side">
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Criterio del sistema</p>
                            <h3>Como decide el agente</h3>
                        </div>
                    </div>
                    <div className="conversation-rules">
                        <div className="conversation-rule"><MessageSquare size={16} /><div><strong>Mensajes no leidos</strong><p>Suben el score para que no se te enfrien respuestas importantes.</p></div></div>
                        <div className="conversation-rule"><Bot size={16} /><div><strong>Prioridad + estado</strong><p>Alta y bloqueada empujan el hilo hacia arriba del tablero.</p></div></div>
                        <div className="conversation-rule"><CircleDot size={16} /><div><strong>Tiempo sin actividad</strong><p>Si pasan varios dias, el agente propone seguimiento inmediato.</p></div></div>
                    </div>
                </article>
            </section>

            <section className="page-actions page-actions--clients">
                <form className="search-bar" onSubmit={submitSearch}>
                    <Search size={16} />
                    <input placeholder="Buscar por titulo, responsable, contexto o siguiente paso" value={draftSearch} onChange={event => setDraftSearch(event.target.value)} />
                    <button className="button button--ghost" type="submit">Buscar</button>
                </form>
                <button className="button button--primary" onClick={() => navigate('/conversations/new')} type="button"><Plus size={16} />Agregar hilo</button>
            </section>

            <FilterBar actions={<button className="button button--ghost" onClick={() => setSearchParams({})} type="button">Limpiar filtros</button>}>
                <label className="field"><span>Estado</span><select value={searchParams.get('status') || ''} onChange={event => setFilterValue('status', event.target.value)}>{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="field"><span>Prioridad</span><select value={searchParams.get('priority') || ''} onChange={event => setFilterValue('priority', event.target.value)}>{priorityOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="field"><span>Canal</span><select value={searchParams.get('channel') || ''} onChange={event => setFilterValue('channel', event.target.value)}>{channelOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </FilterBar>

            <CollectionToolbar summary={`${visibleThreads.length} de ${sortedThreads.length} conversaciones visibles`} helperText="Ordena por score del agente o por actividad reciente." sortValue={sortValue} onSortChange={setSortValue} sortOptions={sortOptions} limitValue={visibleLimit} onLimitChange={setVisibleLimit} />

            {listQuery.isLoading ? <section className="panel"><p>Cargando conversaciones...</p></section> : listQuery.isError ? <section className="panel panel--error"><p>{listQuery.error.message}</p></section> : <DataTable columns={columns} rows={visibleThreads} rowKey="id" empty={<EmptyState title="No hay conversaciones registradas" description="Registra tus otros chats y deja que el agente te ayude a priorizarlos." action={<button className="button button--primary" onClick={() => navigate('/conversations/new')} type="button">Crear conversacion</button>} />} />}

            <DrawerForm open={isDrawerOpen} title={editMatch ? 'Editar conversacion' : 'Nueva conversacion'} description="Documenta el hilo, su objetivo y el siguiente paso." placement="centered" onClose={() => navigate(`/conversations${location.search}`)}>
                <form className="stack-form" onSubmit={event => { event.preventDefault(); saveMutation.mutate(form); }}>
                    <label className="field"><span>Titulo</span><input required value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></label>
                    <div className="form-grid">
                        <label className="field"><span>Responsable</span><input value={form.owner_name} onChange={event => setForm(current => ({ ...current, owner_name: event.target.value }))} /></label>
                        <label className="field"><span>Canal</span><select value={form.channel} onChange={event => setForm(current => ({ ...current, channel: event.target.value }))}>{channelOptions.filter(option => option.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="field"><span>Estado</span><select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))}>{statusOptions.filter(option => option.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="field"><span>Prioridad</span><select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}>{priorityOptions.filter(option => option.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label className="field"><span>Sin leer</span><input min="0" type="number" value={form.unread_count} onChange={event => setForm(current => ({ ...current, unread_count: event.target.value }))} /></label>
                        <label className="field"><span>Ultima actividad</span><input type="datetime-local" value={form.last_activity_at} onChange={event => setForm(current => ({ ...current, last_activity_at: event.target.value }))} /></label>
                    </div>
                    <label className="field"><span>Objetivo</span><textarea rows="3" value={form.objective} onChange={event => setForm(current => ({ ...current, objective: event.target.value }))} /></label>
                    <label className="field"><span>Resumen actual</span><textarea rows="4" value={form.summary} onChange={event => setForm(current => ({ ...current, summary: event.target.value }))} /></label>
                    <label className="field"><span>Ultimo mensaje clave</span><textarea rows="3" value={form.last_message} onChange={event => setForm(current => ({ ...current, last_message: event.target.value }))} /></label>
                    <label className="field"><span>Siguiente accion</span><textarea rows="3" value={form.next_action} onChange={event => setForm(current => ({ ...current, next_action: event.target.value }))} /></label>
                    <button className="button button--primary" disabled={saveMutation.isPending} type="submit">{saveMutation.isPending ? 'Guardando...' : editMatch ? 'Actualizar conversacion' : 'Guardar conversacion'}</button>
                </form>
            </DrawerForm>

            <ConfirmDialog open={Boolean(deleteTarget)} title="Eliminar conversacion" description={`Se eliminara "${deleteTarget?.title || ''}" del tablero del agente.`} confirmLabel={deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'} onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} />
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, Plus, Save } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatMoney, todayIso } from '../lib/format';
import { useToast } from '../components/Toast';

const emptyMovement = {
    date: todayIso(),
    type: 'gasto',
    amount: '',
    payment_type: 'efectivo',
    category: '',
    description: '',
    account: '',
    currentAttachment: ''
};

export default function MovementsFormPage() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [form, setForm] = useState(emptyMovement);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showCategoryCreator, setShowCategoryCreator] = useState(false);
    const [file, setFile] = useState(null);

    const categoriesQuery = useQuery({
        queryKey: ['categories', 'options', 'movements-form'],
        queryFn: () => apiFetch('/api/categories')
    });

    const movementQuery = useQuery({
        queryKey: ['movement', id],
        enabled: isEdit,
        queryFn: () => apiFetch(`/api/movements/${id}`)
    });

    useEffect(() => {
        if (movementQuery.data?.data) {
            const movement = movementQuery.data.data;
            setForm({
                date: movement.date,
                type: movement.type,
                amount: movement.amount,
                payment_type: movement.payment_type,
                category: movement.category,
                description: movement.description,
                account: movement.account,
                currentAttachment: movement.attachment
            });
        }
    }, [movementQuery.data]);

    const createCategoryMutation = useMutation({
        mutationFn: name => apiFetch('/api/categories', { method: 'POST', body: { name } }),
        onSuccess: async response => {
            await queryClient.invalidateQueries({ queryKey: ['categories'] });
            setForm(current => ({ ...current, category: response.data.name }));
            setNewCategoryName('');
            setShowCategoryCreator(false);
            showToast('Categoría creada y seleccionada', 'success');
        },
        onError: error => showToast(error.message, 'danger')
    });

    const saveMutation = useMutation({
        mutationFn: values => {
            const payload = new FormData();
            Object.entries(values).forEach(([key, value]) => {
                payload.append(key, value);
            });

            if (file) {
                payload.append('attachment', file);
            }

            return apiFetch(isEdit ? `/api/movements/${id}` : '/api/movements', {
                method: isEdit ? 'PUT' : 'POST',
                body: payload
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['movements'] });
            showToast(isEdit ? 'Movimiento actualizado' : 'Movimiento creado', 'success');
            navigate('/movements');
        },
        onError: error => showToast(error.message, 'danger')
    });

    return (
        <div className="page-stack">
            <Link className="inline-link" to="/movements">
                <ArrowLeft size={14} />
                Volver al ledger
            </Link>

            <section className="editor-grid">
                <form
                    className="panel panel--editor"
                    onSubmit={event => {
                        event.preventDefault();
                        saveMutation.mutate(form);
                    }}
                >
                    <div className="panel__header">
                        <div>
                            <p className="panel__eyebrow">Movimientos</p>
                            <h3>{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>
                        </div>
                    </div>

                    <div className="form-grid">
                        <label className="field">
                            <span>Fecha</span>
                            <input
                                type="date"
                                value={form.date}
                                onChange={event =>
                                    setForm(current => ({ ...current, date: event.target.value }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Tipo</span>
                            <select
                                value={form.type}
                                onChange={event =>
                                    setForm(current => ({ ...current, type: event.target.value }))
                                }
                            >
                                <option value="gasto">Gasto</option>
                                <option value="ingreso">Ingreso</option>
                            </select>
                        </label>

                        <label className="field">
                            <span>Monto</span>
                            <input
                                min="0"
                                step="0.01"
                                type="number"
                                value={form.amount}
                                onChange={event =>
                                    setForm(current => ({ ...current, amount: event.target.value }))
                                }
                            />
                        </label>

                        <label className="field">
                            <span>Tipo de pago</span>
                            <select
                                value={form.payment_type}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        payment_type: event.target.value
                                    }))
                                }
                            >
                                <option value="efectivo">Efectivo</option>
                                <option value="llave">Llave</option>
                                <option value="nequi">Nequi</option>
                                <option value="daviplata">Daviplata</option>
                                <option value="colpatria">Colpatria</option>
                            </select>
                        </label>

                        <label className="field field--full">
                            <span>Categoría</span>
                            <div className="inline-field">
                                <select
                                    value={form.category}
                                    onChange={event =>
                                        setForm(current => ({
                                            ...current,
                                            category: event.target.value
                                        }))
                                    }
                                >
                                    <option value="">Selecciona una categoría</option>
                                    {(categoriesQuery.data?.data || []).map(category => (
                                        <option key={category.id} value={category.name}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    className="button button--ghost"
                                    onClick={() => setShowCategoryCreator(current => !current)}
                                    type="button"
                                >
                                    <Plus size={16} />
                                    Nueva
                                </button>
                            </div>
                        </label>

                        {showCategoryCreator ? (
                            <div className="inline-creator">
                                <input
                                    placeholder="Nombre de la categoría"
                                    value={newCategoryName}
                                    onChange={event => setNewCategoryName(event.target.value)}
                                />
                                <button
                                    className="button button--primary"
                                    disabled={createCategoryMutation.isPending}
                                    onClick={() => createCategoryMutation.mutate(newCategoryName)}
                                    type="button"
                                >
                                    Guardar
                                </button>
                            </div>
                        ) : null}

                        <label className="field field--full">
                            <span>Descripción</span>
                            <textarea
                                rows="3"
                                value={form.description}
                                onChange={event =>
                                    setForm(current => ({
                                        ...current,
                                        description: event.target.value
                                    }))
                                }
                            />
                        </label>

                        <label className="field field--full">
                            <span>Adjunto</span>
                            <div className="upload-card">
                                <label className="button button--ghost upload-card__button">
                                    <Paperclip size={16} />
                                    Seleccionar archivo
                                    <input
                                        hidden
                                        type="file"
                                        onChange={event => setFile(event.target.files?.[0] || null)}
                                    />
                                </label>
                                <div>
                                    <strong>{file?.name || form.currentAttachment || 'Sin archivo'}</strong>
                                    <span>
                                        {file
                                            ? 'Archivo listo para subir'
                                            : form.currentAttachment
                                                ? 'Adjunto actual conservado'
                                                : 'PDF, Excel, Word o imagen'}
                                    </span>
                                </div>
                            </div>
                        </label>
                    </div>

                    <button className="button button--primary" disabled={saveMutation.isPending} type="submit">
                        <Save size={16} />
                        {saveMutation.isPending ? 'Guardando...' : isEdit ? 'Actualizar movimiento' : 'Guardar movimiento'}
                    </button>
                </form>

                <aside className="panel panel--summary">
                    <p className="panel__eyebrow">Monto actual</p>
                    <h3>{formatMoney(form.amount || 0)}</h3>
                    <p className="summary-note">
                        Registra el movimiento con contexto y adjunto para que el ledger mantenga trazabilidad.
                    </p>
                </aside>
            </section>
        </div>
    );
}

const pool = require('../config/db');

const PRIORITY_OPTIONS = new Set(['alta', 'media', 'baja']);
const STATUS_OPTIONS = new Set([
    'pendiente',
    'en_progreso',
    'en_espera',
    'resuelta',
    'bloqueada'
]);
const CHANNEL_OPTIONS = new Set([
    'chatgpt',
    'whatsapp',
    'instagram',
    'email',
    'telefono',
    'otro'
]);

let ensurePromise = null;

function normalizeValue(value) {
    return String(value || '').trim();
}

function normalizeLimitedValue(value, validValues, fallback) {
    const normalized = normalizeValue(value).toLowerCase();
    return validValues.has(normalized) ? normalized : fallback;
}

function normalizeTimestamp(value) {
    if (!value) {
        return new Date();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoString(value) {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toNullableText(value) {
    const normalized = normalizeValue(value);
    return normalized || null;
}

function toPriorityWeight(priority) {
    switch (priority) {
        case 'alta':
            return 60;
        case 'media':
            return 35;
        case 'baja':
        default:
            return 15;
    }
}

function toStatusWeight(status) {
    switch (status) {
        case 'bloqueada':
            return 42;
        case 'pendiente':
            return 30;
        case 'en_espera':
            return 24;
        case 'en_progreso':
            return 20;
        case 'resuelta':
        default:
            return -18;
    }
}

function getStaleDays(lastActivityAt) {
    const timestamp = new Date(lastActivityAt).getTime();

    if (Number.isNaN(timestamp)) {
        return 0;
    }

    const diffMs = Date.now() - timestamp;
    return Math.max(0, Math.floor(diffMs / 86400000));
}

function computeManagerScore(thread) {
    const staleDays = getStaleDays(thread.last_activity_at);
    const unread = Number(thread.unread_count || 0);
    const unresolvedBonus = thread.status === 'resuelta' ? 0 : 12;

    return (
        toPriorityWeight(thread.priority) +
        toStatusWeight(thread.status) +
        unresolvedBonus +
        unread * 4 +
        Math.min(staleDays * 3, 21)
    );
}

function buildManagerNote(thread) {
    const staleDays = getStaleDays(thread.last_activity_at);

    if (thread.status === 'bloqueada') {
        return thread.next_action
            ? `Bloqueo activo. Destraba primero: ${thread.next_action}`
            : 'Bloqueo activo. Define un paso concreto para destrabarla.';
    }

    if (thread.priority === 'alta' && Number(thread.unread_count || 0) > 0) {
        return `Prioridad alta con ${thread.unread_count} mensaje(s) sin revisar. Atiendela primero.`;
    }

    if (thread.status === 'pendiente') {
        return thread.next_action
            ? `Pendiente de ejecucion. Siguiente paso: ${thread.next_action}`
            : 'Pendiente de ejecucion. Define el siguiente paso y responde.';
    }

    if (thread.status === 'en_espera' && staleDays >= 2) {
        return `Lleva ${staleDays} dia(s) en espera. Conviene hacer seguimiento hoy.`;
    }

    if (thread.status === 'en_progreso' && staleDays >= 3) {
        return 'En progreso sin actividad reciente. Retomala antes de que se enfrie.';
    }

    if (thread.status === 'resuelta') {
        return 'Resuelta. Puedes archivarla o dejar una nota final de cierre.';
    }

    return thread.next_action
        ? `Mantener impulso. Proximo paso recomendado: ${thread.next_action}`
        : 'Mantener contexto actualizado para no perder continuidad.';
}

function mapConversationThread(row) {
    const thread = {
        id: row.id,
        title: row.title,
        owner_name: row.owner_name || '',
        channel: row.channel,
        status: row.status,
        priority: row.priority,
        objective: row.objective || '',
        summary: row.summary || '',
        last_message: row.last_message || '',
        next_action: row.next_action || '',
        unread_count: Number(row.unread_count || 0),
        last_activity_at: toIsoString(row.last_activity_at),
        created_at: toIsoString(row.created_at),
        updated_at: toIsoString(row.updated_at)
    };

    return {
        ...thread,
        manager_score: computeManagerScore(thread),
        manager_note: buildManagerNote(thread)
    };
}

async function ensureConversationThreadsSchema() {
    if (ensurePromise) {
        return ensurePromise;
    }

    ensurePromise = (async () => {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS conversation_threads (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(180) NOT NULL,
                owner_name VARCHAR(120) NULL,
                channel VARCHAR(24) NOT NULL DEFAULT 'chatgpt',
                status VARCHAR(24) NOT NULL DEFAULT 'pendiente',
                priority VARCHAR(24) NOT NULL DEFAULT 'media',
                objective TEXT NULL,
                summary TEXT NULL,
                last_message TEXT NULL,
                next_action TEXT NULL,
                unread_count INT NOT NULL DEFAULT 0,
                last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_conversation_threads_status (status),
                INDEX idx_conversation_threads_priority (priority),
                INDEX idx_conversation_threads_last_activity (last_activity_at)
            )
        `);
    })();

    try {
        await ensurePromise;
    } catch (error) {
        ensurePromise = null;
        throw error;
    }
}

async function listConversationThreads({
    search = '',
    status = '',
    priority = '',
    channel = ''
} = {}) {
    await ensureConversationThreadsSchema();

    const where = [];
    const params = [];
    const term = normalizeValue(search);

    if (term) {
        where.push(`(
            title LIKE ?
            OR owner_name LIKE ?
            OR objective LIKE ?
            OR summary LIKE ?
            OR next_action LIKE ?
        )`);
        params.push(`%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`);
    }

    const normalizedStatus = normalizeLimitedValue(status, STATUS_OPTIONS, '');
    if (normalizedStatus) {
        where.push('status = ?');
        params.push(normalizedStatus);
    }

    const normalizedPriority = normalizeLimitedValue(priority, PRIORITY_OPTIONS, '');
    if (normalizedPriority) {
        where.push('priority = ?');
        params.push(normalizedPriority);
    }

    const normalizedChannel = normalizeLimitedValue(channel, CHANNEL_OPTIONS, '');
    if (normalizedChannel) {
        where.push('channel = ?');
        params.push(normalizedChannel);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.execute(
        `
            SELECT *
              FROM conversation_threads
              ${whereClause}
          ORDER BY last_activity_at DESC, updated_at DESC, id DESC
        `,
        params
    );

    return rows.map(mapConversationThread).sort((left, right) => {
        if (right.manager_score !== left.manager_score) {
            return right.manager_score - left.manager_score;
        }

        return new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime();
    });
}

async function getConversationThreadById(id) {
    await ensureConversationThreadsSchema();

    const [rows] = await pool.execute(
        'SELECT * FROM conversation_threads WHERE id = ?',
        [id]
    );

    return rows.length ? mapConversationThread(rows[0]) : null;
}

async function createConversationThread(payload) {
    await ensureConversationThreadsSchema();

    const title = normalizeValue(payload.title);
    if (!title) {
        throw new Error('El titulo de la conversacion es obligatorio');
    }

    const ownerName = normalizeValue(payload.owner_name);
    const channel = normalizeLimitedValue(payload.channel, CHANNEL_OPTIONS, 'chatgpt');
    const status = normalizeLimitedValue(payload.status, STATUS_OPTIONS, 'pendiente');
    const priority = normalizeLimitedValue(payload.priority, PRIORITY_OPTIONS, 'media');
    const objective = toNullableText(payload.objective);
    const summary = toNullableText(payload.summary);
    const lastMessage = toNullableText(payload.last_message);
    const nextAction = toNullableText(payload.next_action);
    const unreadCount = Math.max(0, Number(payload.unread_count || 0));
    const lastActivityAt = normalizeTimestamp(payload.last_activity_at);

    const [result] = await pool.execute(
        `
            INSERT INTO conversation_threads (
                title,
                owner_name,
                channel,
                status,
                priority,
                objective,
                summary,
                last_message,
                next_action,
                unread_count,
                last_activity_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            title,
            ownerName || null,
            channel,
            status,
            priority,
            objective,
            summary,
            lastMessage,
            nextAction,
            unreadCount,
            lastActivityAt
        ]
    );

    return getConversationThreadById(result.insertId);
}

async function updateConversationThread(id, payload) {
    await ensureConversationThreadsSchema();

    const existing = await getConversationThreadById(id);
    if (!existing) {
        return null;
    }

    const title = normalizeValue(payload.title);
    if (!title) {
        throw new Error('El titulo de la conversacion es obligatorio');
    }

    const ownerName = normalizeValue(payload.owner_name);
    const channel = normalizeLimitedValue(payload.channel, CHANNEL_OPTIONS, 'chatgpt');
    const status = normalizeLimitedValue(payload.status, STATUS_OPTIONS, 'pendiente');
    const priority = normalizeLimitedValue(payload.priority, PRIORITY_OPTIONS, 'media');
    const objective = toNullableText(payload.objective);
    const summary = toNullableText(payload.summary);
    const lastMessage = toNullableText(payload.last_message);
    const nextAction = toNullableText(payload.next_action);
    const unreadCount = Math.max(0, Number(payload.unread_count || 0));
    const lastActivityAt = normalizeTimestamp(payload.last_activity_at);

    await pool.execute(
        `
            UPDATE conversation_threads
               SET title = ?,
                   owner_name = ?,
                   channel = ?,
                   status = ?,
                   priority = ?,
                   objective = ?,
                   summary = ?,
                   last_message = ?,
                   next_action = ?,
                   unread_count = ?,
                   last_activity_at = ?
             WHERE id = ?
        `,
        [
            title,
            ownerName || null,
            channel,
            status,
            priority,
            objective,
            summary,
            lastMessage,
            nextAction,
            unreadCount,
            lastActivityAt,
            id
        ]
    );

    return getConversationThreadById(id);
}

async function deleteConversationThread(id) {
    await ensureConversationThreadsSchema();
    await pool.execute('DELETE FROM conversation_threads WHERE id = ?', [id]);
}

async function getConversationThreadsSummary() {
    const threads = await listConversationThreads();

    return {
        total: threads.length,
        urgent: threads.filter(
            thread => thread.priority === 'alta' && thread.status !== 'resuelta'
        ).length,
        blocked: threads.filter(thread => thread.status === 'bloqueada').length,
        waitingReply: threads.filter(
            thread => thread.unread_count > 0 && thread.status !== 'resuelta'
        ).length,
        stale: threads.filter(
            thread =>
                thread.status !== 'resuelta' &&
                getStaleDays(thread.last_activity_at) >= 3
        ).length,
        recommendations: threads.slice(0, 5).map(thread => ({
            id: thread.id,
            title: thread.title,
            owner_name: thread.owner_name,
            priority: thread.priority,
            status: thread.status,
            unread_count: thread.unread_count,
            manager_note: thread.manager_note
        }))
    };
}

module.exports = {
    createConversationThread,
    deleteConversationThread,
    getConversationThreadById,
    getConversationThreadsSummary,
    listConversationThreads,
    updateConversationThread
};

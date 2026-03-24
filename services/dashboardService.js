const pool = require('../config/db');
const { hashId } = require('../config/encryption');
const { formatProperCase } = require('../utils/properCase');
const {
    getPreviousEqualRange,
    resolveDashboardRange,
    toExclusiveEnd,
    toIsoDate
} = require('../utils/dateRange');

function buildSalesFilters({ clientId, paid }) {
    const clauses = ['active = 1'];
    const params = [];

    if (clientId) {
        clauses.push('client_id = ?');
        params.push(clientId);
    }

    if (paid === '0' || paid === '1') {
        clauses.push('paid = ?');
        params.push(Number(paid));
    }

    return { clauses, params };
}

async function fetchStats(range, filters) {
    const { clauses, params } = buildSalesFilters(filters);

    clauses.push('sold_at >= ?');
    params.push(range.start);
    clauses.push('sold_at < ?');
    params.push(range.endExclusive);

    const [[row]] = await pool.execute(
        `SELECT
            COUNT(*) AS sales_count,
            COALESCE(SUM(price), 0) AS total_revenue,
            COALESCE(SUM(quantity), 0) AS total_quantity
         FROM sales
         WHERE ${clauses.join(' AND ')}`,
        params
    );

    return {
        salesCount: Number(row.sales_count),
        totalRevenue: Number(row.total_revenue),
        totalQuantity: Number(row.total_quantity)
    };
}

async function fetchPendings(clientId) {
    const clauses = ['s.active = 1', 's.paid = 0'];
    const params = [];

    if (clientId) {
        clauses.push('s.client_id = ?');
        params.push(clientId);
    }

    const [rows] = await pool.execute(
        `SELECT
            c.id,
            c.name,
            c.phone,
            c.address,
            SUM(s.price) AS debt
         FROM sales s
         JOIN clients c ON c.id = s.client_id
         WHERE ${clauses.join(' AND ')}
         GROUP BY c.id, c.name, c.phone, c.address
         HAVING debt > 0
         ORDER BY debt DESC`,
        params
    );

    return rows.map(row => ({
        id: row.id,
        hash: hashId(row.id),
        name: formatProperCase(row.name),
        phone: row.phone || '',
        address: row.address || '',
        debt: Number(row.debt)
    }));
}

async function fetchClients() {
    const [rows] = await pool.execute('SELECT id, name FROM clients ORDER BY name');
    return rows.map(row => ({ id: row.id, name: formatProperCase(row.name) }));
}

async function getDashboardSummary(filters = {}) {
    const { startDate, endDate } = resolveDashboardRange(filters.start, filters.end);
    const previous = getPreviousEqualRange(startDate, endDate);

    const currentRange = {
        start: toIsoDate(startDate),
        end: toIsoDate(endDate),
        endExclusive: toIsoDate(toExclusiveEnd(endDate))
    };

    const previousRange = {
        start: toIsoDate(previous.startDate),
        end: toIsoDate(previous.endDate),
        endExclusive: toIsoDate(toExclusiveEnd(previous.endDate))
    };

    const [currentStats, previousStats, pendings, clients] = await Promise.all([
        fetchStats(currentRange, filters),
        fetchStats(previousRange, filters),
        fetchPendings(filters.clientId),
        fetchClients()
    ]);

    const revenueDiff = currentStats.totalRevenue - previousStats.totalRevenue;
    const revenuePct =
        previousStats.totalRevenue > 0
            ? (revenueDiff / previousStats.totalRevenue) * 100
            : currentStats.totalRevenue > 0
                ? 100
                : 0;

    return {
        filters: {
            start: currentRange.start,
            end: currentRange.end,
            client_id: filters.clientId || '',
            paid: filters.paid || ''
        },
        currentRange: {
            start: currentRange.start,
            end: currentRange.end
        },
        previousRange: {
            start: previousRange.start,
            end: previousRange.end
        },
        summary: {
            current: currentStats,
            previous: previousStats,
            revenueDiff,
            revenuePct
        },
        pendings,
        clients
    };
}

module.exports = {
    getDashboardSummary
};

// controllers/reportsController.js
const pool = require('../config/db');

exports.index = async (req, res) => {
    let { from, to, type, category } = req.query;

    // Establecer últimos 30 días por defecto si no se especifican fechas
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    from = from || thirtyDaysAgo.toISOString().split('T')[0];
    to   = to   || today.toISOString().split('T')[0];

    // Armar filtros dinámicamente
    const filtros = ['date BETWEEN ? AND ?'];
    const valores = [from, to];

    if (type) {
        filtros.push('type = ?');
        valores.push(type);
    }

    if (category) {
        filtros.push('category = ?');
        valores.push(category);
    }

    const whereClause = `WHERE ${filtros.join(' AND ')}`;

    // ───────────── Gráfica: Ingresos vs Gastos por mes ─────────────
    const [monthlyTotals] = await pool.query(`
        SELECT DATE_FORMAT(date, '%Y-%m') AS mes, type, SUM(amount) AS total
        FROM movements
        ${whereClause}
        GROUP BY mes, type
        ORDER BY mes
    `, valores);

    // ───────────── Gráfica: Gastos por categoría ─────────────
    const [gastosPorCategoria] = await pool.query(`
        SELECT category, SUM(amount) AS total
        FROM movements
        WHERE type = 'gasto' AND date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY total DESC
    `, [from, to]);

    // ───────────── Gráfica: Totales por método de pago ─────────────
    const [pagosPorMetodo] = await pool.query(`
        SELECT payment_type, SUM(amount) AS total
        FROM movements
        ${whereClause}
        GROUP BY payment_type
        ORDER BY total DESC
    `, valores);

    // Obtener todas las categorías disponibles para el filtro
    const [allCategories] = await pool.query(`
        SELECT DISTINCT category FROM movements ORDER BY category
    `);

    // Renderizar vista
    res.render('reports/index', {
        monthlyTotals,
        gastosPorCategoria,
        pagosPorMetodo,
        allCategories,
        from,
        to,
        type,
        category
    });
};

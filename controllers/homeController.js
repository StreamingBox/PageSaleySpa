// controllers/homeController.js
const pool    = require('../config/db');
const ExcelJS = require('exceljs');
const {
    parseISO, isValid, format,
    subDays, addDays
} = require('date-fns');

/* ---------------------------------------------------- *
 *                     DASHBOARD                        *
 * ---------------------------------------------------- */
exports.dashboard = async (req, res) => {
    /* ---------- 1. Rango solicitado o últimos 30 días ---------- */
    const safeParse = s => {
        if (!s) return null;
        try {
            const d = parseISO(s);
            return isValid(d) ? d : null;
        } catch { return null; }
    };

    const today = new Date();
    const startDt = safeParse(req.query.start) ?? subDays(today, 29);
    const endDt   = safeParse(req.query.end)   ?? today;

    const startISO = format(startDt, 'yyyy-MM-dd');
    const endISO   = format(endDt,   'yyyy-MM-dd');

    /* ---------- 2. Periodo anterior (igual nº de días) ---------- */
    const daySpan   = Math.ceil((endDt - startDt) / 86_400_000) + 1;
    const prevStart = subDays(startDt, daySpan);
    const prevEnd   = subDays(endDt,   daySpan);

    /* ---------- 3. Helper para sumar ventas -------------------- */
    const stats = async (from, to) => {
        const [r] = await pool.execute(
            `SELECT COUNT(*)        AS n,
              COALESCE(SUM(price),0) AS total
         FROM sales
        WHERE sold_at >= ? AND sold_at < ?`,
            [format(from,'yyyy-MM-dd'),
                format(addDays(to,1),'yyyy-MM-dd')]
        );
        return r[0];
    };

    const cur  = await stats(startDt, endDt);
    const prev = await stats(prevStart, prevEnd);

    /* ---------- 4. Variación % (evita Infinity) ---------------- */
    const diff  = cur.total - prev.total;
    const pct   = prev.total > 0
        ? ((diff / prev.total) * 100).toFixed(1)
        : 0;                     // muestra 0 %

    /* ---------- 5. Clientes con deuda -------------------------- */
    const [pendings] = await pool.execute(
        `SELECT c.name, c.phone, SUM(s.price) AS debt
       FROM sales s
       JOIN clients c ON c.id = s.client_id
      WHERE s.paid = 0
      GROUP BY c.id`
    );

    /* ---------- 6. Render -------------------------------------- */
    res.render('home/dashboard', {
        startISO, endISO,

        lastTotal : cur.total
            .toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}),
        lastCount : cur.n,

        prevTotal : prev.total
            .toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}),
        prevCount : prev.n,

        diff,
        pct,                 // la vista decide flecha / color con diff

        pendings,
        money : n => '$' + Number(n)
            .toLocaleString('es-CO',{minimumFractionDigits:0})
    });
};

/* ---------------------------------------------------- *
 *                EXPORTAR  EXCEL                       *
 * ---------------------------------------------------- */
exports.exportExcel = async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.redirect('/');

    const [rows] = await pool.execute(
        `SELECT sold_at                       AS Fecha,
            (SELECT name FROM clients  WHERE id=s.client_id)  AS Cliente,
            (SELECT name FROM products WHERE id=s.product_id) AS Producto,
            price                          AS Precio,
            CASE WHEN paid=1 THEN 'Pagado' ELSE 'Pendiente' END AS Estado,
            payment_source                AS Origen
       FROM sales s
      WHERE sold_at BETWEEN ? AND ?
      ORDER BY sold_at`,
        [start, end]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Ventas');
    ws.columns = Object.keys(rows[0] || { }).map(h => ({ header: h, key: h }));
    rows.forEach(r => ws.addRow(r));

    res.setHeader('Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
        `attachment; filename="ventas_${start}_a_${end}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
};

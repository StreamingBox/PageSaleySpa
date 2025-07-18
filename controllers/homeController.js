// controllers/dashboardController.js

const pool    = require('../config/db');
const ExcelJS = require('exceljs');
const {
    parseISO,
    isValid,
    format,
    subDays,
    addDays
} = require('date-fns');

exports.dashboard = async (req, res) => {
    try {
        // 1) Parsear fechas
        const safeParse = s => {
            if (!s) return null;
            let d = parseISO(s);
            if (isValid(d)) return d;
            const parts = s.split('/');
            if (parts.length === 3) {
                const [dd, mm, yyyy] = parts;
                d = new Date(`${yyyy}-${mm}-${dd}`);
                if (isValid(d)) return d;
            }
            return null;
        };

        const today   = new Date();
        const startDt = safeParse(req.query.start) ?? subDays(today, 29);
        const endDt   = safeParse(req.query.end)   ?? today;

        // 2) Formatos
        const startISO = format(startDt, 'yyyy-MM-dd');
        const endISO   = format(endDt,   'yyyy-MM-dd');
        const startFmt = format(startDt, 'dd/MM/yyyy');
        const endFmt   = format(endDt,   'dd/MM/yyyy');

        // 3) Filtros
        const clientId   = req.query.client_id || '';
        const paidFilter = (req.query.paid === '0' || req.query.paid === '1')
            ? req.query.paid
            : '';

        // 4) Periodo anterior
        const daySpan   = Math.ceil((endDt - startDt) / 86_400_000) + 1;
        const prevStart = subDays(startDt, daySpan);
        const prevEnd   = subDays(endDt,   daySpan);

        // 5) Estadísticas
        const stats = async (from, to) => {
            const clauses = ['active = 1', 'sold_at >= ?', 'sold_at < ?'];
            const params  = [
                format(from, 'yyyy-MM-dd'),
                format(addDays(to, 1), 'yyyy-MM-dd')
            ];
            if (clientId) {
                clauses.push('client_id = ?');
                params.push(clientId);
            }
            if (paidFilter) {
                clauses.push('paid = ?');
                params.push(paidFilter);
            }
            const sql = `
        SELECT
          COUNT(*)    AS n,
          COALESCE(SUM(price), 0)    AS total,    -- usar solo price
          COALESCE(SUM(quantity), 0) AS totalQty
        FROM sales
        WHERE ${clauses.join(' AND ')}
      `;
            const [[r]] = await pool.execute(sql, params);
            return r;
        };

        const cur  = await stats(startDt, endDt);
        const prev = await stats(prevStart, prevEnd);

        // 6) Clientes con deuda pendiente
        const pendClauses = ['s.active = 1', 's.paid = 0'];
        const pendParams  = [];
        if (clientId) {
            pendClauses.push('s.client_id = ?');
            pendParams.push(clientId);
        }
        const pendSql = `
      SELECT
        c.name,
        c.phone,
        SUM(s.price) AS debt         -- usar solo price
      FROM sales s
      JOIN clients c ON c.id = s.client_id
      WHERE ${pendClauses.join(' AND ')}
      GROUP BY c.id, c.name, c.phone
      HAVING debt > 0
      ORDER BY debt DESC
    `;
        const [pendings] = await pool.execute(pendSql, pendParams);

        // 7) Lista de clientes para el filtro
        const [clients] = await pool.execute(
            'SELECT id, name FROM clients ORDER BY name'
        );

        // 8) Helper moneda
        const fmtMoney = n =>
            '$ ' + Number(n).toLocaleString('es-CO', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });

        // 9) Render
        res.render('home/dashboard', {
            startISO,
            endISO,
            startFmt,
            endFmt,
            clientId,
            paidFilter,
            clients,
            lastTotal  : fmtMoney(cur.total),
            lastCount  : cur.n,
            lastQty    : cur.totalQty,
            prevTotal  : fmtMoney(prev.total),
            prevCount  : prev.n,
            prevQty    : prev.totalQty,
            diff       : cur.total - prev.total,
            pct        : prev.total > 0
                ? ((cur.total - prev.total) / prev.total * 100).toFixed(1)
                : 0,
            pendings,
            money      : fmtMoney
        });
    } catch (err) {
        console.error('Error en dashboard:', err);
        res.status(500).send('Error interno del servidor');
    }
};

exports.exportExcel = async (req, res) => {
    try {
        const { start, end, client_id, paid } = req.query;
        if (!start || !end) return res.redirect('/');

        const clauses = ['s.active = 1', 's.sold_at BETWEEN ? AND ?'];
        const params  = [start, end];
        if (client_id) {
            clauses.push('s.client_id = ?');
            params.push(client_id);
        }
        if (paid === '0' || paid === '1') {
            clauses.push('s.paid = ?');
            params.push(paid);
        }

        const sql = `
      SELECT
        DATE_FORMAT(s.sold_at, '%d/%m/%Y')    AS Fecha,
        c.name                                AS Cliente,
        p.name                                AS Producto,
        s.quantity                            AS Cantidad,
        s.price                               AS Precio,
        CASE WHEN s.paid=1 THEN 'Pagado' ELSE 'Pendiente' END AS Estado,
        s.payment_source                     AS Origen
      FROM sales s
      JOIN clients c ON c.id = s.client_id
      JOIN products p ON p.id = s.product_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY s.sold_at
    `;
        const [rows] = await pool.execute(sql, params);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Ventas');

        ws.columns = [
            { header: 'Fecha',    key: 'Fecha',    width: 12 },
            { header: 'Cliente',  key: 'Cliente',  width: 25 },
            { header: 'Producto', key: 'Producto', width: 30 },
            { header: 'Cantidad', key: 'Cantidad', width: 10 },
            { header: 'Precio',   key: 'Precio',   width: 12 },
            { header: 'Estado',   key: 'Estado',   width: 12 },
            { header: 'Origen',   key: 'Origen',   width: 20 }
        ];

        ws.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type:    'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6B00B6' }
            };
            cell.alignment = { horizontal: 'center' };
            cell.border = {
                top:    { style: 'thin' },
                left:   { style: 'thin' },
                bottom: { style: 'thin' },
                right:  { style: 'thin' }
            };
        });

        ws.getColumn('Precio').numFmt = '"$"#,##0';

        rows.forEach(r => {
            ws.addRow({
                Fecha:    r.Fecha,
                Cliente:  r.Cliente,
                Producto: r.Producto,
                Cantidad: parseInt(r.Cantidad, 10),
                Precio:   parseFloat(r.Precio),
                Estado:   r.Estado,
                Origen:   r.Origen
            });
        });

        const lastDataRow = ws.rowCount;
        for (let i = 2; i <= lastDataRow; i++) {
            ws.getRow(i).eachCell(cell => {
                cell.border = {
                    top:    { style: 'thin' },
                    left:   { style: 'thin' },
                    bottom: { style: 'thin' },
                    right:  { style: 'thin' }
                };
            });
        }

        const totalRow = ws.addRow({
            Fecha:   '',
            Cliente: '',
            Producto:'Total',
            Cantidad:{ formula: `SUM(D2:D${lastDataRow})` },
            Precio:  { formula: `SUM(E2:E${lastDataRow})` },
            Estado:  '',
            Origen:  ''
        });

        ['D','E'].forEach(col => {
            const cell = totalRow.getCell(col);
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFF0000' } };
            cell.font = { bold:true, color:{ argb:'FFFFFFFF' } };
            cell.alignment = { horizontal: col==='E' ? 'right' : 'center' };
            cell.border = {
                top:    { style: 'thin' },
                left:   { style: 'thin' },
                bottom: { style: 'thin' },
                right:  { style: 'thin' }
            };
            if (col==='E') cell.numFmt = '"$"#,##0';
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        let filename = `ventas_${start}_a_${end}`;
        if (client_id) filename += `_c${client_id}`;
        if (paid)      filename += `_paid${paid}`;
        filename += '.xlsx';
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error al exportar Excel:', err);
        res.status(500).send('Error interno al exportar');
    }
};

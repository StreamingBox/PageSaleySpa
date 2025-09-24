const Mov = require('../models/movementsModel');

// helper: YYYY-MM-DD
function ymd(d) { return d.toISOString().slice(0,10); }

// rango del mes calendario que contiene la fecha dada
function monthRange(dateLike) {
    const d = new Date(dateLike);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0); // último día
    return { start: ymd(start), end: ymd(end) };
}

// rango del mes anterior al de la fecha dada
function prevMonthRange(dateLike) {
    const d = new Date(dateLike);
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end   = new Date(d.getFullYear(), d.getMonth(), 0);
    return { start: ymd(start), end: ymd(end) };
}

exports.overview = async (req, res, next) => {
    try {
        // Si el usuario envía start/end, usamos ese mes; si no, mes actual
        const qStart = (req.query.start || '').trim();
        const qEnd   = (req.query.end   || '').trim();

        let currentRange, previousRange;

        if (qStart && qEnd) {
            // Tomamos el mes natural al que pertenece qStart
            currentRange  = monthRange(qStart);
            previousRange = prevMonthRange(qStart);
        } else {
            const today = new Date();
            currentRange  = monthRange(today);
            previousRange = prevMonthRange(today);
        }

        const cur = await Mov.totalsByTypeInRange(currentRange.start, currentRange.end);
        const prev = await Mov.totalsByTypeInRange(previousRange.start, previousRange.end);

        const curIngresos = cur.ingreso.total || 0;
        const curGastos   = cur.gasto.total   || 0;
        const curBalance  = curIngresos - curGastos;

        const prevIngresos = prev.ingreso.total || 0;
        const prevGastos   = prev.gasto.total   || 0;
        const prevBalance  = prevIngresos - prevGastos;

        // variación vs mes anterior (sobre el balance)
        let deltaPct = 0;
        if (prevBalance === 0) {
            deltaPct = curBalance === 0 ? 0 : 100; // evita división por cero
        } else {
            deltaPct = ((curBalance - prevBalance) / Math.abs(prevBalance)) * 100;
        }

        res.render('reports/overview', {
            path: '/reports',
            currentRange,
            previousRange,
            cur, prev,
            curIngresos, curGastos, curBalance,
            prevIngresos, prevGastos, prevBalance,
            deltaPct,
            filters: { start: qStart, end: qEnd }
        });
    } catch (err) {
        next(err);
    }
};

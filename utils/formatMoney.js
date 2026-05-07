function formatMoney(n) {
    return '$ ' + Number(n).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

module.exports = { formatMoney };

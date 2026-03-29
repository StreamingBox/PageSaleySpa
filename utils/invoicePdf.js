const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// LOGO OFICIAL PNG (Base 100% sobre el archivo logo.png)
const logoPngPath = path.join(__dirname, '..', 'public', 'brand', 'logo.png');

const palette = {
    indigo: '#A777CF',
    indigoSoft: '#F4EDFB',
    cyan: '#79CFCD',
    cyanSoft: '#EAF8F7',
    roseSoft: '#FFF2F3',
    ink: '#564B6A',
    inkSoft: '#7F7694',
    border: '#E8DDF1',
    tableHeader: '#F7F1FB',
    rowAlt: '#FCFAFE',
    rowLine: '#EEE6F5',
    success: '#6FAF81',
    successSoft: '#EAF7EE',
    danger: '#D84F5F',
    dangerSoft: '#FFF1F2',
    white: '#FFFFFF'
};

const layout = {
    left: 44,
    right: 44,
    top: 40,
    bottom: 42,
    pageWidth: 595.28,
    pageHeight: 841.89
};

const contentWidth = layout.pageWidth - layout.left - layout.right;

function formatMoney(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatLongDate(value) {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    }).format(new Date(value));
}

function formatShortDate(value) {
    if (!value) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date(value));
}

function compareInvoiceItems(left, right) {
    const leftTime = new Date(left.sold_at).getTime();
    const rightTime = new Date(right.sold_at).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    const lineOrderDiff = Number(left.line_order || 0) - Number(right.line_order || 0);
    if (lineOrderDiff !== 0) return lineOrderDiff;
    return Number(left.id || 0) - Number(right.id || 0);
}

function drawRoundedBox(doc, x, y, width, height, fill, stroke) {
    doc.save();
    doc.roundedRect(x, y, width, height, 18).fillAndStroke(fill, stroke);
    doc.restore();
}

function drawStatusBadge(doc, status, x, y) {
    const tone = status === 'PAGADA'
        ? { fill: palette.successSoft, stroke: '#CBE7D3', text: palette.success }
        : { fill: palette.dangerSoft, stroke: '#F2CAD0', text: palette.danger };

    const badgeWidth = 102;
    const badgeHeight = 24;

    doc.save();
    doc.roundedRect(x, y, badgeWidth, badgeHeight, 12).fillAndStroke(tone.fill, tone.stroke);
    doc.fillColor(tone.text).font('Helvetica-Bold').fontSize(10).text(status, x, y + 7, { width: badgeWidth, align: 'center' });
    doc.restore();
}

function drawBrand(doc) {
    const brandX = layout.left;
    const brandY = 28;
    const brandBoxWidth = 150;
    const brandBoxHeight = 72;
    try {
        if (fs.existsSync(logoPngPath)) {
            doc.image(logoPngPath, brandX, brandY, {
                fit: [brandBoxWidth, brandBoxHeight],
                align: 'left',
                valign: 'center'
            });
        }
    } catch (e) {
        console.error('Error cargando logo en PDF:', e);
    }

    doc
        .fillColor(palette.inkSoft)
        .font('Helvetica')
        .fontSize(9)
        .text('Factura interna de control comercial', brandX, brandY + brandBoxHeight + 8, {
            width: brandBoxWidth
        });
}

function drawInvoiceMeta(doc, invoice) {
    doc.fillColor(palette.inkSoft).font('Helvetica-Bold').fontSize(10).text('FACTURA', layout.pageWidth - layout.right - 140, 50, { width: 140, align: 'right' });
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(28).text(invoice.invoice_number, layout.pageWidth - layout.right - 180, 64, { width: 180, align: 'right' });
    drawStatusBadge(doc, invoice.status, layout.pageWidth - layout.right - 102, 96);
    doc.moveTo(layout.left, 136).lineTo(layout.pageWidth - layout.right, 136).strokeColor(palette.border).lineWidth(1).stroke();
}

function drawInfoCards(doc, invoice) {
    const y = 158;
    const gap = 16;
    const cardWidth = (contentWidth - gap) / 2;
    const cardHeight = 124;

    drawRoundedBox(doc, layout.left, y, cardWidth, cardHeight, palette.white, palette.border);
    drawRoundedBox(doc, layout.left + cardWidth + gap, y, cardWidth, cardHeight, palette.white, palette.border);

    doc.fillColor(palette.inkSoft).font('Helvetica-Bold').fontSize(10).text('CLIENTE', layout.left + 18, y + 16).text('DETALLE', layout.left + cardWidth + gap + 18, y + 16);
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(18).text(invoice.client_name, layout.left + 18, y + 34, { width: cardWidth - 36 });
    doc.fillColor(palette.inkSoft).font('Helvetica').fontSize(11)
        .text(invoice.client_phone || 'Sin teléfono', layout.left + 18, y + 60, { width: cardWidth - 36 })
        .text([invoice.client_address, invoice.client_complemento].filter(Boolean).join(' · ') || 'Sin dirección registrada', layout.left + 18, y + 80, { width: cardWidth - 36 });

    const metaX = layout.left + cardWidth + gap + 18;
    const metaWidth = cardWidth - 36;
    doc.fillColor(palette.inkSoft).font('Helvetica-Bold').fontSize(10).text('Emisión', metaX, y + 36).text('Estado', metaX, y + 64).text('Pago', metaX, y + 92);
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(11).text(formatLongDate(invoice.issue_date), metaX + 78, y + 36, { width: metaWidth - 78, align: 'right' })
        .text(invoice.status === 'PAGADA' ? 'Pagada' : 'Pendiente', metaX + 78, y + 64, { width: metaWidth - 78, align: 'right' })
        .text(invoice.status === 'PAGADA' ? `${invoice.payment_source} · ${formatShortDate(invoice.paid_at)}` : 'Pendiente', metaX + 78, y + 92, { width: metaWidth - 78, align: 'right' });

    return y + cardHeight + 24;
}

function drawPageHeader(doc, invoice, includeCards = true) {
    drawBrand(doc);
    drawInvoiceMeta(doc, invoice);
    if (includeCards) return drawInfoCards(doc, invoice);
    doc.fillColor(palette.inkSoft).font('Helvetica').fontSize(11).text(`${invoice.invoice_number} · ${invoice.client_name}`, layout.left, 145, { width: contentWidth });
    return 178;
}

function getTableColumns() {
    const innerX = layout.left + 12;
    const gap = 8;
    const conceptWidth = 184;
    const dateWidth = 86;
    const quantityWidth = 40;
    const unitWidth = 70;
    const totalWidth = contentWidth - 24 - conceptWidth - dateWidth - quantityWidth - unitWidth - gap * 4;
    return [
        { key: 'product_name', label: 'Concepto', x: innerX, width: conceptWidth, align: 'left' },
        { key: 'sold_at', label: 'Fecha', x: innerX + conceptWidth + gap, width: dateWidth, align: 'left' },
        { key: 'quantity', label: 'Cant.', x: innerX + conceptWidth + dateWidth + gap * 2, width: quantityWidth, align: 'right' },
        { key: 'unit_price', label: 'Unitario', x: innerX + conceptWidth + dateWidth + quantityWidth + gap * 3, width: unitWidth, align: 'right' },
        { key: 'line_total', label: 'Total', x: innerX + conceptWidth + dateWidth + quantityWidth + unitWidth + gap * 4, width: totalWidth, align: 'right' }
    ];
}

function drawTableHeader(doc, y) {
    const columns = getTableColumns();
    drawRoundedBox(doc, layout.left, y, contentWidth, 30, palette.tableHeader, palette.border);
    doc.fillColor(palette.inkSoft).font('Helvetica-Bold').fontSize(10);
    columns.forEach(column => { doc.text(column.label, column.x, y + 10, { width: column.width, align: column.align }); });
    return y + 42;
}

function drawItemRow(doc, item, index, y, columns) {
    const conceptHeight = doc.heightOfString(item.product_name, { width: columns[0].width, align: 'left' });
    const rowHeight = Math.max(34, Math.ceil(conceptHeight + 18));

    if (index % 2 === 0) { doc.save().roundedRect(layout.left, y - 4, contentWidth, rowHeight, 12).fill(palette.rowAlt).restore(); }
    doc.fillColor(palette.ink).font('Helvetica-Bold').fontSize(11).text(item.product_name, columns[0].x, y + 4, { width: columns[0].width });
    doc.fillColor(palette.inkSoft).font('Helvetica').fontSize(10).text(formatShortDate(item.sold_at), columns[1].x, y + 5, { width: columns[1].width })
        .fillColor(palette.ink).font('Helvetica').fontSize(11).text(String(item.quantity), columns[2].x, y + 5, { width: columns[2].width, align: 'right' })
        .text(formatMoney(item.unit_price), columns[3].x, y + 5, { width: columns[3].width, align: 'right' })
        .font('Helvetica-Bold').text(formatMoney(item.line_total), columns[4].x, y + 5, { width: columns[4].width, align: 'right' });

    doc.moveTo(layout.left + 6, y + rowHeight).lineTo(layout.left + contentWidth - 6, y + rowHeight).strokeColor(palette.rowLine).lineWidth(1).stroke();
    return y + rowHeight + 6;
}

function drawTotalsCard(doc, invoice, y) {
    const boxWidth = 208;
    const boxHeight = 78;
    const x = layout.pageWidth - layout.right - boxWidth;
    const safeY = Math.min(y, layout.pageHeight - layout.bottom - boxHeight - 18);
    drawRoundedBox(doc, x, safeY, boxWidth, boxHeight, palette.white, palette.border);
    doc.fillColor(palette.inkSoft).font('Helvetica-Bold').fontSize(10).text('Subtotal', x + 18, safeY + 18).text('Total', x + 18, safeY + 46);
    doc.fillColor(palette.ink).font('Helvetica').fontSize(11).text(formatMoney(invoice.subtotal), x + 96, safeY + 18, { width: 92, align: 'right' })
        .font('Helvetica-Bold').fontSize(16).text(formatMoney(invoice.total), x + 82, safeY + 42, { width: 106, align: 'right' });
    return safeY + boxHeight;
}

function drawFooter(doc) {
    const footerText = 'Documento interno de SaleySpa para control comercial y seguimiento de cobro.';
    const footerHeight = doc.heightOfString(footerText, { width: contentWidth, align: 'center' });
    const footerY = layout.pageHeight - layout.bottom - footerHeight - 6;
    doc.fillColor(palette.inkSoft).font('Helvetica').fontSize(9).text(footerText, layout.left, footerY, { width: contentWidth, align: 'center' });
}

function renderInvoicePdf(invoice, writableStream) {
    const doc = new PDFDocument({ size: 'A4', margins: { top: layout.top, right: layout.right, bottom: layout.bottom, left: layout.left } });
    doc.pipe(writableStream);

    const columns = getTableColumns();
    let cursorY = drawPageHeader(doc, invoice, true);
    cursorY = drawTableHeader(doc, cursorY);
    const maxTableY = layout.pageHeight - layout.bottom - 138;
    const items = [...(invoice.items || [])].sort(compareInvoiceItems);

    items.forEach((item, index) => {
        const conceptHeight = doc.heightOfString(item.product_name, { width: columns[0].width, align: 'left' });
        const rowHeight = Math.max(34, Math.ceil(conceptHeight + 18));
        if (cursorY + rowHeight > maxTableY) {
            drawFooter(doc);
            doc.addPage();
            cursorY = drawPageHeader(doc, invoice, false);
            cursorY = drawTableHeader(doc, cursorY);
        }
        cursorY = drawItemRow(doc, item, index, cursorY, columns);
    });

    if (cursorY + 92 > layout.pageHeight - layout.bottom - 24) {
        drawFooter(doc);
        doc.addPage();
        cursorY = drawPageHeader(doc, invoice, false);
    }
    drawTotalsCard(doc, invoice, cursorY + 14);
    drawFooter(doc);
    doc.end();
}

module.exports = { renderInvoicePdf };

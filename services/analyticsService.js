const pool = require('../config/db');
const { formatProperCase } = require('../utils/properCase');

const PRODUCT_COLORS = [
    '#a777cf',
    '#79cfcd',
    '#7db68d',
    '#d7a56f',
    '#d84f5f',
    '#c58fcf',
    '#8d84a0',
    '#90c9c8',
    '#cdb3de',
    '#e4b98f'
];

function parseFlexibleDateParts(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return {
            year: value.getFullYear(),
            month: value.getMonth() + 1,
            day: value.getDate()
        };
    }

    const safeValue = String(value).trim();

    if (!safeValue) {
        return null;
    }

    const isoMatch = safeValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return {
            year: Number(isoMatch[1]),
            month: Number(isoMatch[2]),
            day: Number(isoMatch[3])
        };
    }

    const localeMatch = safeValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (localeMatch) {
        return {
            year: Number(localeMatch[3]),
            month: Number(localeMatch[2]),
            day: Number(localeMatch[1])
        };
    }

    const parsed = new Date(safeValue);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate()
    };
}

function normalizeYear(value) {
    const currentYear = new Date().getFullYear();
    const year = Number(value);

    if (!Number.isInteger(year) || year < 2020 || year > currentYear + 1) {
        return currentYear;
    }

    return year;
}

function monthKey(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function monthLabel(year, monthIndex) {
    return new Intl.DateTimeFormat('es-CO', {
        month: 'short',
        year: 'numeric'
    })
        .format(new Date(year, monthIndex, 1))
        .replace('.', '');
}

function monthTag(year, monthIndex) {
    return monthLabel(year, monthIndex).toUpperCase();
}

function parseSaleDate(value) {
    return parseFlexibleDateParts(value) || {
        year: 0,
        month: 0,
        day: 0
    };
}

function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function createMonthBucket(year, monthIndex) {
    const days = getDaysInMonth(year, monthIndex);
    const weeklyLength = Math.ceil(days / 7);

    return {
        key: monthKey(year, monthIndex),
        monthIndex,
        label: monthLabel(year, monthIndex),
        tag: monthTag(year, monthIndex),
        revenue: 0,
        orders: 0,
        daily: Array.from({ length: days }, (_, index) => ({
            label: String(index + 1),
            revenue: 0,
            orders: 0
        })),
        weekly: Array.from({ length: weeklyLength }, (_, index) => ({
            label: `Sem ${index + 1}`,
            revenue: 0,
            orders: 0
        })),
        products: new Map()
    };
}

function getBucketBestWeek(bucket) {
    return bucket.weekly.reduce(
        (best, current, index) => {
            if (current.revenue > best.revenue) {
                return {
                    week: index + 1,
                    revenue: current.revenue,
                    orders: current.orders
                };
            }

            return best;
        },
        { week: 1, revenue: 0, orders: 0 }
    );
}

async function listAnalyticsRows() {
    const [rows] = await pool.execute(
        `
            SELECT
                s.id,
                s.price,
                s.quantity,
                s.sold_at,
                p.name AS product_name
              FROM sales s
              LEFT JOIN products p ON p.id = s.product_id
             WHERE s.active = 1
             ORDER BY s.sold_at ASC, s.id ASC
        `
    );

    return rows;
}

function listAvailableYears(rows) {
    const years = [...new Set(rows.map(row => parseSaleDate(row.sold_at).year).filter(Boolean))]
        .sort((left, right) => right - left);

    return years.length ? years : [new Date().getFullYear()];
}

async function getSalesAnalytics(inputYear = '') {
    const rows = await listAnalyticsRows();
    const availableYears = listAvailableYears(rows);
    const normalizedInputYear = normalizeYear(inputYear);
    const year =
        availableYears.includes(Number(inputYear)) || availableYears.includes(normalizedInputYear)
            ? Number(inputYear) || normalizedInputYear
            : availableYears[0];

    const buckets = Array.from({ length: 12 }, (_, monthIndex) =>
        createMonthBucket(year, monthIndex)
    );

    rows.forEach(row => {
        const { year: saleYear, month, day } = parseSaleDate(row.sold_at);

        if (saleYear !== year) {
            return;
        }

        const monthIndex = month - 1;
        const bucket = buckets[monthIndex];

        if (!bucket || !day) {
            return;
        }

        const revenue = Number(row.price || 0);
        const orders = Math.max(1, Number(row.quantity || 1));
        const weekIndex = Math.floor((day - 1) / 7);
        const productName = formatProperCase(row.product_name || 'Servicio');
        const productEntry = bucket.products.get(productName) || {
            name: productName,
            revenue: 0,
            orders: 0
        };

        bucket.revenue += revenue;
        bucket.orders += orders;
        bucket.daily[day - 1].revenue += revenue;
        bucket.daily[day - 1].orders += orders;

        if (bucket.weekly[weekIndex]) {
            bucket.weekly[weekIndex].revenue += revenue;
            bucket.weekly[weekIndex].orders += orders;
        }

        productEntry.revenue += revenue;
        productEntry.orders += orders;
        bucket.products.set(productName, productEntry);
    });

    const months = buckets.map(bucket => {
        const bestWeek = getBucketBestWeek(bucket);
        const products = [...bucket.products.values()]
            .sort((left, right) => right.revenue - left.revenue)
            .map((product, index) => ({
                ...product,
                percentage: bucket.revenue > 0 ? (product.revenue / bucket.revenue) * 100 : 0,
                color: PRODUCT_COLORS[index % PRODUCT_COLORS.length]
            }));

        return {
            key: bucket.key,
            monthIndex: bucket.monthIndex,
            label: bucket.label,
            tag: bucket.tag,
            revenue: bucket.revenue,
            orders: bucket.orders,
            bestWeek: {
                label: `Semana ${bestWeek.week}`,
                revenue: bestWeek.revenue,
                orders: bestWeek.orders
            },
            series: {
                monthly: bucket.daily,
                weekly: bucket.weekly
            },
            breakdown: products
        };
    });

    const activeMonths = months.filter(month => month.revenue > 0);

    return {
        year,
        years: availableYears,
        months,
        active_months: activeMonths,
        totals: {
            revenue: activeMonths.reduce((total, month) => total + month.revenue, 0),
            orders: activeMonths.reduce((total, month) => total + month.orders, 0)
        }
    };
}

module.exports = {
    getSalesAnalytics
};

const pool = require('../config/db');
const { formatProperCase } = require('../utils/properCase');

const PRODUCT_COLORS = [
    '#22b8ff',
    '#8b5cf6',
    '#1fd18f',
    '#ffb11f',
    '#ff5470',
    '#f857a6',
    '#4c8dff',
    '#20c4d8',
    '#7ce56d',
    '#ff7b39'
];

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
    const safeValue = String(value).slice(0, 10);
    const [year, month, day] = safeValue.split('-').map(Number);

    return {
        year,
        month,
        day
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

async function listAvailableYears() {
    const [rows] = await pool.execute(
        `
            SELECT
                MIN(YEAR(sold_at)) AS min_year,
                MAX(YEAR(sold_at)) AS max_year
              FROM sales
             WHERE active = 1
        `
    );

    const minYear = Number(rows[0]?.min_year || new Date().getFullYear());
    const maxYear = Number(rows[0]?.max_year || new Date().getFullYear());
    const years = [];

    for (let year = maxYear; year >= minYear; year -= 1) {
        years.push(year);
    }

    return years.length ? years : [new Date().getFullYear()];
}

async function getSalesAnalytics(inputYear = '') {
    const availableYears = await listAvailableYears();
    const normalizedInputYear = normalizeYear(inputYear);
    const year =
        availableYears.includes(Number(inputYear)) || availableYears.includes(normalizedInputYear)
            ? Number(inputYear) || normalizedInputYear
            : availableYears[0];

    const [rows] = await pool.execute(
        `
            SELECT
                s.price,
                s.quantity,
                s.sold_at,
                p.name AS product_name
              FROM sales s
              JOIN products p ON p.id = s.product_id
             WHERE s.active = 1
               AND YEAR(s.sold_at) = ?
             ORDER BY s.sold_at ASC, s.id ASC
        `,
        [year]
    );

    const buckets = Array.from({ length: 12 }, (_, monthIndex) =>
        createMonthBucket(year, monthIndex)
    );

    rows.forEach(row => {
        const { month, day } = parseSaleDate(row.sold_at);
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

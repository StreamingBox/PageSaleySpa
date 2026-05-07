import { describe, it, expect } from 'vitest';
import { parseIsoDate, toIsoDate, resolveDashboardRange, getPreviousEqualRange } from '../../utils/dateRange.js';

describe('dateRange', () => {
    describe('parseIsoDate', () => {
        it('should parse a valid ISO date string', () => {
            const result = parseIsoDate('2024-06-15');
            expect(result).toBeInstanceOf(Date);
            expect(result.getFullYear()).toBe(2024);
        });

        it('should return null for empty input', () => {
            expect(parseIsoDate('')).toBeNull();
            expect(parseIsoDate(null)).toBeNull();
            expect(parseIsoDate(undefined)).toBeNull();
        });

        it('should return null for invalid date', () => {
            expect(parseIsoDate('not-a-date')).toBeNull();
        });
    });

    describe('toIsoDate', () => {
        it('should format a Date to yyyy-MM-dd', () => {
            const date = new Date(2024, 5, 15);
            expect(toIsoDate(date)).toBe('2024-06-15');
        });
    });

    describe('resolveDashboardRange', () => {
        it('should resolve start and end dates', () => {
            const result = resolveDashboardRange('2024-06-01', '2024-06-30');
            expect(result.startDate).toBeInstanceOf(Date);
            expect(result.endDate).toBeInstanceOf(Date);
        });

        it('should default to 30-day range when start is missing', () => {
            const result = resolveDashboardRange('', '2024-06-30');
            const diff = result.endDate.getTime() - result.startDate.getTime();
            expect(diff).toBeGreaterThan(0);
        });

        it('should swap dates when start > end', () => {
            const result = resolveDashboardRange('2024-06-30', '2024-06-01');
            expect(result.startDate.getTime()).toBeLessThanOrEqual(result.endDate.getTime());
        });
    });

    describe('getPreviousEqualRange', () => {
        it('should return previous period of equal length', () => {
            const start = new Date(2024, 5, 10);
            const end = new Date(2024, 5, 20);
            const prev = getPreviousEqualRange(start, end);
            const span1 = end.getTime() - start.getTime();
            const span2 = prev.endDate.getTime() - prev.startDate.getTime();
            expect(span1).toBe(span2);
            expect(prev.endDate.getTime()).toBeLessThan(start.getTime());
        });
    });
});

import { describe, it, expect } from 'vitest';
import { getCsrfTokenFromRequest } from '../../utils/csrfToken.js';

describe('csrfToken', () => {
    it('prefers the csrf header over the form body', () => {
        const token = getCsrfTokenFromRequest({
            headers: { 'x-csrf-token': 'header-token' },
            body: { _csrf: 'body-token' }
        });

        expect(token).toBe('header-token');
    });

    it('falls back to the form body token', () => {
        const token = getCsrfTokenFromRequest({
            headers: {},
            body: { _csrf: 'body-token' }
        });

        expect(token).toBe('body-token');
    });

    it('handles repeated csrf headers', () => {
        const token = getCsrfTokenFromRequest({
            headers: { 'x-csrf-token': ['', 'first-token', 'second-token'] },
            body: {}
        });

        expect(token).toBe('first-token');
    });

    it('returns an empty token when no token exists', () => {
        expect(getCsrfTokenFromRequest({ headers: {}, body: {} })).toBe('');
    });
});

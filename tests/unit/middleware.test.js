import { describe, it, expect, vi } from 'vitest';

describe('auth middleware', () => {
    function createMockReq(session = {}) {
        return { session };
    }

    function createMockRes() {
        const res = {};
        res._redirect = null;
        res._status = null;
        res._json = null;
        res.redirect = function (url) { res._redirect = url; return res; };
        res.status = function (code) { res._status = code; return res; };
        res.json = function (data) { res._json = data; return res; };
        return res;
    }

    describe('isAuth', () => {
        it('should call next when user is in session', () => {
            const { isAuth } = require('../../middleware/auth.js');
            const req = createMockReq({ user: { id: 1 } });
            const res = createMockRes();
            const next = vi.fn();

            isAuth(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(res._redirect).toBeNull();
        });

        it('should redirect to login when no user', () => {
            const { isAuth } = require('../../middleware/auth.js');
            const req = createMockReq({});
            const res = createMockRes();
            const next = vi.fn();

            isAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res._redirect).toBe('/login');
        });
    });

    describe('isApiAuth', () => {
        it('should call next when user is in session', () => {
            const { isApiAuth } = require('../../middleware/apiAuth.js');
            const req = createMockReq({ user: { id: 1 } });
            const res = createMockRes();
            const next = vi.fn();

            isApiAuth(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should return 401 when no user', () => {
            const { isApiAuth } = require('../../middleware/apiAuth.js');
            const req = createMockReq({});
            const res = createMockRes();
            const next = vi.fn();

            isApiAuth(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res._status).toBe(401);
            expect(res._json).toEqual({ error: 'No autorizado' });
        });
    });
});

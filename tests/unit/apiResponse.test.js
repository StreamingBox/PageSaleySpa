import { describe, it, expect } from 'vitest';
import { sendData, sendError } from '../../utils/apiResponse.js';

describe('apiResponse', () => {
    describe('sendData', () => {
        it('should return JSON with data key', () => {
            const res = createMockRes();
            sendData(res, { name: 'Test' });
            expect(res._json).toEqual({ data: { name: 'Test' } });
        });

        it('should include meta when provided', () => {
            const res = createMockRes();
            const meta = { page: 1, total: 10 };
            sendData(res, [{ id: 1 }], meta);
            expect(res._json).toEqual({ data: [{ id: 1 }], meta });
        });
    });

    describe('sendError', () => {
        it('should return JSON with error key and status', () => {
            const res = createMockRes();
            sendError(res, 400, 'Bad request');
            expect(res._status).toBe(400);
            expect(res._json).toEqual({ error: 'Bad request' });
        });

        it('should include details when provided', () => {
            const res = createMockRes();
            sendError(res, 422, 'Validation error', { field: 'email' });
            expect(res._status).toBe(422);
            expect(res._json).toEqual({
                error: 'Validation error',
                details: { field: 'email' }
            });
        });

        it('should not include details when not provided', () => {
            const res = createMockRes();
            sendError(res, 500, 'Server error');
            expect(res._json).toEqual({ error: 'Server error' });
            expect(res._json.details).toBeUndefined();
        });
    });
});

function createMockRes() {
    const res = {};
    res._status = null;
    res._json = null;
    res.status = function (code) {
        res._status = code;
        return res;
    };
    res.json = function (data) {
        res._json = data;
        return res;
    };
    return res;
}

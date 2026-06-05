import { describe, it, expect } from 'vitest';
import { getEnvWarnings, validateEnv } from '../../config/env.js';

const baseEnv = {
    DB_HOST: 'localhost',
    DB_USER: 'root',
    DB_NAME: 'saleyspa'
};

describe('env validation', () => {
    it('allows a development database without a password', () => {
        expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'development' })).not.toThrow();
    });

    it('requires secrets and database password in production', () => {
        expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
            /DB_PASSWORD.*SESSION_SECRET.*HASH_SECRET/
        );
    });

    it('passes production validation when required values are present', () => {
        expect(() =>
            validateEnv({
                ...baseEnv,
                NODE_ENV: 'production',
                DB_PASSWORD: 'secret',
                SESSION_SECRET: 'session-secret',
                HASH_SECRET: 'hash-secret'
            })
        ).not.toThrow();
    });

    it('warns about development fallback secrets', () => {
        expect(getEnvWarnings({ ...baseEnv, NODE_ENV: 'development' })).toEqual([
            'SESSION_SECRET no esta configurado; usando valor de desarrollo.',
            'HASH_SECRET no esta configurado; usando valor de desarrollo.'
        ]);
    });
});

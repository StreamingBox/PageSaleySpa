import { describe, it, expect } from 'vitest';
import { hashId, hashedLookupClause } from '../../config/encryption.js';

describe('encryption', () => {
    describe('hashId', () => {
        it('should return a hex string', () => {
            const result = hashId(123);
            expect(typeof result).toBe('string');
            expect(/^[a-f0-9]+$/.test(result)).toBe(true);
        });

        it('should produce different hashes for different ids', () => {
            const hash1 = hashId(1);
            const hash2 = hashId(2);
            expect(hash1).not.toBe(hash2);
        });

        it('should produce the same hash for the same id', () => {
            const hash1 = hashId(42);
            const hash2 = hashId(42);
            expect(hash1).toBe(hash2);
        });
    });

    describe('hashedLookupClause', () => {
        it('should return SQL clause with column', () => {
            const clause = hashedLookupClause('client_id');
            expect(clause).toContain('SHA1');
            expect(clause).toContain('client_id');
        });

        it('should default column to id', () => {
            const clause = hashedLookupClause();
            expect(clause).toContain('id');
        });
    });
});

const crypto = require('crypto');
const ALGO = 'sha1';
const DEV_SECRET = 'cambiame_por_algo_secreto';

function resolveSecret() {
    if (process.env.HASH_SECRET) {
        return process.env.HASH_SECRET;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('HASH_SECRET es requerido en produccion');
    }

    return DEV_SECRET;
}

const SECRET = resolveSecret();

function hashId(id) {
    return crypto.createHash(ALGO).update(`${SECRET}${id}`).digest('hex');
}

function hashedLookupClause(column = 'id') {
    return `BINARY SHA1(CONCAT(?, ${column})) = BINARY ?`;
}

module.exports = {
    SECRET,
    hashId,
    hashedLookupClause
};

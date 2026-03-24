const crypto = require('crypto');
const ALGO = 'sha1';
const SECRET = process.env.HASH_SECRET || 'cambiame_por_algo_secreto';

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

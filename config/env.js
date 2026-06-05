function getRequiredEnvKeys(env = process.env) {
    const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];

    if (env.NODE_ENV === 'production') {
        required.push('DB_PASSWORD', 'SESSION_SECRET', 'HASH_SECRET');
    }

    return required;
}

function validateEnv(env = process.env) {
    const missing = getRequiredEnvKeys(env).filter(key => !env[key]);

    if (missing.length) {
        throw new Error(
            `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
            'Copia .env.example a .env y configura los valores.'
        );
    }
}

function getEnvWarnings(env = process.env) {
    if (env.NODE_ENV === 'production') {
        return [];
    }

    const warnings = [];

    if (!env.SESSION_SECRET) {
        warnings.push('SESSION_SECRET no esta configurado; usando valor de desarrollo.');
    }

    if (!env.HASH_SECRET) {
        warnings.push('HASH_SECRET no esta configurado; usando valor de desarrollo.');
    }

    return warnings;
}

module.exports = {
    getEnvWarnings,
    getRequiredEnvKeys,
    validateEnv
};

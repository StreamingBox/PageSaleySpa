import js from '@eslint/js';

export default [
    js.configs.recommended,

    {
        ignores: [
            'node_modules/**',
            'public/**',
            'dist/**',
            'android/**',
            'test-results/**',
            'playwright-report/**',
            'coverage/**',
            '.playwright-register.js',
            'src/**',
            'tests/**',
            '*.config.mjs',
            '*.config.js'
        ]
    },

    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                Buffer: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-console': 'off',
            'no-undef': 'error',
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    }
];

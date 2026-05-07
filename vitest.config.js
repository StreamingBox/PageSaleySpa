import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['utils/**/*.js', 'middleware/**/*.js', 'services/**/*.js'],
            thresholds: {
                statements: 50,
                branches: 40,
                functions: 50,
                lines: 50
            }
        }
    }
});

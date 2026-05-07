const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: 'http://127.0.0.1:3000',
        trace: 'on-first-retry'
    },
    webServer: {
        command: 'npm run build && node app.js',
        url: 'http://127.0.0.1:3000/health',
        timeout: 60000,
        reuseExistingServer: !process.env.CI
    }
});

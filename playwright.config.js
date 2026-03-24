const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 60000,
    use: {
        baseURL: 'http://127.0.0.1:3000',
        trace: 'on-first-retry'
    },
    webServer: {
        command: 'npm start',
        url: 'http://127.0.0.1:3000/login',
        timeout: 120000,
        reuseExistingServer: !process.env.CI
    }
});

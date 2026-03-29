import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.saleyspa.app',
    appName: 'SaleySpa',
    webDir: 'android-web',
    server: {
        url: 'https://saleyspa.shop/',
        cleartext: false,
        allowNavigation: ['saleyspa.shop', '*.saleyspa.shop']
    },
    android: {
        backgroundColor: '#fcfbfd'
    }
};

export default config;

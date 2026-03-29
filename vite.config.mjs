import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    base: '/app/',
    publicDir: false,
    build: {
        outDir: path.resolve(__dirname, 'public/app'),
        emptyOutDir: true,
        cssCodeSplit: true,
        rollupOptions: {
            input: {
                app: path.resolve(__dirname, 'src/ui/main.jsx'),
                login: path.resolve(__dirname, 'src/auth-login/main.jsx')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: assetInfo => {
                    if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                        return '[name][extname]';
                    }

                    return 'assets/[name][extname]';
                }
            }
        }
    }
});

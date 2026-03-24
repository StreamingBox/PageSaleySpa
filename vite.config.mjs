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
        cssCodeSplit: false,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/ui/main.jsx'),
            output: {
                entryFileNames: 'app.js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: assetInfo => {
                    if (assetInfo.name && assetInfo.name.endsWith('.css')) {
                        return 'app.css';
                    }

                    return 'assets/[name][extname]';
                }
            }
        }
    }
});

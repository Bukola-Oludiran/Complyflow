import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Proxy /api to the local ComplyFlow API so the browser stays same-origin.
// The API sends no CORS headers, so cross-origin calls would be blocked.
const proxy = {
    '/api': process.env.COMPLYFLOW_API_URL ?? 'http://127.0.0.1:3000',
};

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: { proxy },
    preview: { proxy },
});

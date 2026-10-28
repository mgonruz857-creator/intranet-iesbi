import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: la misma compilación vale en /intranet-iesbi/ (pruebas) y en la raíz (centro)
  base: './',
  plugins: [react(), tailwindcss()],
});

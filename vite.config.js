import { defineConfig } from 'vite';

// base: './' => les chemins d'assets sont relatifs, indispensable pour que
// l'appli fonctionne une fois empaquetee dans l'APK (WebView locale).
export default defineConfig({
  base: './',
  build: {
    target: 'es2018',
    outDir: 'dist'
  }
});

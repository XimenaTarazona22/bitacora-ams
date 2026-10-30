// vite-plugin-singlefile deja dist/index.html; la entrega se llama BitacoraAMS.html
import { renameSync } from 'node:fs';

renameSync('dist/index.html', 'dist/BitacoraAMS.html');
console.log('dist/BitacoraAMS.html listo');

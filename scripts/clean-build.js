const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = ['dist', 'dist-electron', '.angular'];

for (const dir of targets) {
  const fullPath = path.join(root, dir);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`[clean] Eliminado: ${dir}`);
  } catch (error) {
    console.warn(`[clean] No se pudo eliminar ${dir}:`, error.message);
  }
}

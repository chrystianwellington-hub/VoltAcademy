// Gera a versão executável (um único .html que abre com dois cliques em qualquer navegador).
// Uso: node scripts/build-standalone.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const body = readFileSync(join(root, 'simulador/comandos-eletricos.html'), 'utf8');
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/VoltAcademy-Comandos-Eletricos.html'), html);
console.log('Gerado: dist/VoltAcademy-Comandos-Eletricos.html');

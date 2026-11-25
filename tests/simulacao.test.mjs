// Testes do motor de simulação e da interface com Playwright.
// Uso: node scripts/build-standalone.mjs && node tests/simulacao.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../dist/VoltAcademy-Comandos-Eletricos.html')).href;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', e => errors.push(e.message));
await p.goto(page);
await p.waitForTimeout(600);

const results = await p.evaluate(async () => {
  const va = window.__va, out = [];
  const tag = t => va.doc().comps.find(c => c.tag === t);
  const lit = t => Object.entries(va.sim.lamps).some(([id, v]) => v && va.doc().comps.find(c => c.id === id).tag === t);
  const check = (name, cond) => out.push([name, !!cond]);
  const press = t => { va.sim.pressed.add(tag(t).id); va.solve(); va.sim.pressed.clear(); va.solve(); };

  va.load(va.EXAMPLES[0].build()); va.startSim();
  check('Partida direta: K1 desligado em repouso', !va.sim.coils.K1);
  va.sim.pressed.add(tag('S1').id); va.solve();
  check('Partida direta: S1 liga K1', va.sim.coils.K1);
  check('Partida direta: H1 acende com K1', lit('H1'));
  va.sim.pressed.clear(); va.solve();
  check('Partida direta: selo mantém K1 ao soltar S1', va.sim.coils.K1);
  press('S0');
  check('Partida direta: S0 desliga K1', !va.sim.coils.K1);
  press('S1'); va.sim.tripped.add('FT1'); va.solve();
  check('Partida direta: relé térmico desarma K1', !va.sim.coils.K1);
  check('Partida direta: H2 sinaliza falha', lit('H2'));
  va.stopSim();

  va.load(va.EXAMPLES[1].build()); va.startSim();
  press('S1');
  check('Reversão: K1 com selo', va.sim.coils.K1);
  va.sim.pressed.add(tag('S2').id); va.solve();
  check('Reversão: intertravamento bloqueia K2', !va.sim.coils.K2 && va.sim.coils.K1);
  va.sim.pressed.clear(); press('S0'); press('S2');
  check('Reversão: K2 liga após parar K1', va.sim.coils.K2 && !va.sim.coils.K1);
  va.stopSim();

  va.load({ project: 'curto', comps: [{ id: 'c1', type: 'fase', x: 200, y: 100, tag: 'L' }, { id: 'c2', type: 'neutro', x: 200, y: 300, tag: 'N' }],
    wires: [{ id: 'w1', a: { c: 'c1', t: 'a' }, b: { c: 'c2', t: 'a' }, color: '#000', pts: [] }] });
  va.startSim();
  check('Curto-circuito detectado e simulação parada', !va.sim.running && !document.getElementById('banner').hidden);

  va.load(va.EXAMPLES[2].build()); va.startSim(); press('S1');
  check('Temporizador: H1 apagado no início', va.sim.coils.K1 && !lit('H1'));
  await new Promise(r => setTimeout(r, 3600));
  check('Temporizador: H1 acende após 3 s', va.sim.timerDone.KT1 && lit('H1'));
  va.stopSim();
  return out;
});

// Interação real com o mouse: segurar S1 durante a simulação
await p.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); document.getElementById('bFit').click(); });
await p.click('#bRun');
const id = await p.evaluate(() => window.__va.doc().comps.find(c => c.tag === 'S1').id);
const bb = await p.locator(`[data-comp="${id}"] .chit`).boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.mouse.down(); await p.waitForTimeout(100);
results.push(['Mouse: segurar S1 liga K1', await p.evaluate(() => !!window.__va.sim.coils.K1)]);
await p.mouse.up(); await p.waitForTimeout(100);
results.push(['Mouse: soltar S1 mantém K1 (selo)', await p.evaluate(() => !!window.__va.sim.coils.K1)]);

const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(page); await m.waitForTimeout(500);
results.push(['Celular: sem rolagem horizontal', !(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth))]);
results.push(['Sem erros de JavaScript', errors.length === 0]);
await browser.close();

let failed = 0;
for (const [name, ok] of results) { console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}`); if (!ok) failed++; }
console.log(`\n${results.length - failed}/${results.length} testes passaram`);
if (errors.length) console.log('Erros:', errors);
process.exit(failed ? 1 : 0);

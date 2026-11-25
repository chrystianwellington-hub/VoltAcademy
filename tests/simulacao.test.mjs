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

  va.load(va.EXAMPLES[2].build()); va.startSim();
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

  va.load(va.EXAMPLES[3].build()); va.startSim(); press('S1');
  check('Temporizador: H1 apagado no início', va.sim.coils.K1 && !lit('H1'));
  await new Promise(r => setTimeout(r, 3600));
  check('Temporizador: H1 acende após 3 s', va.sim.timerDone.KT1 && lit('H1'));
  va.stopSim();
  // ---- Circuito de força ----
  va.load(va.EXAMPLES[1].build()); va.startSim();
  const M = () => va.sim.motors[va.doc().comps.find(c => c.type === 'motor_3f').id];
  check('Força: motor parado em repouso', !M().run);
  press('S1');
  check('Força: S1 liga K1 e o motor gira no sentido horário', va.sim.coils.K1 && M().run && M().dir === 'horário');
  va.sim.tripped.add('FT1'); va.solve();
  check('Força: relé térmico derruba K1 e para o motor', !va.sim.coils.K1 && !M().run);
  va.sim.tripped.clear(); va.solve(); press('S1');
  { const d = va.doc(), m = d.comps.find(c => c.type === 'motor_3f');
    const wu = d.wires.find(w => w.b.c === m.id && w.b.t === 'u'), wv = d.wires.find(w => w.b.c === m.id && w.b.t === 'v');
    wu.b.t = 'v'; wv.b.t = 'u'; va.solve();
    check('Força: inverter duas fases inverte o giro', M().run && M().dir === 'anti-horário');
    d.wires = d.wires.filter(w => !(w.b.c === m.id && w.b.t === 'w')); va.solve();
    check('Força: falta de fase detectada no motor', !M().run && M().msg === 'Falta de fase'); }
  va.stopSim();

  const mk = (comps, wires) => va.load({ project: 't', comps: comps.map(([id, type, tag, extra]) => ({ id, type, x: 400, y: 400, rot: 0, tag, ...(extra || {}) })),
    wires: wires.map(([a, ta, b, tb], i) => ({ id: 'w' + (i + 100), a: { c: a, t: ta }, b: { c: b, t: tb }, color: '#000', pts: [] })) });
  const M6 = () => va.sim.motors.m;

  mk([['f', 'fonte_3f', 'X1'], ['m', 'motor_6p', 'M1'], ['j', 'juncao', '']],
     [['f', 'l1', 'm', 'u1'], ['f', 'l2', 'm', 'v1'], ['f', 'l3', 'm', 'w1'], ['m', 'u2', 'j', 'a'], ['m', 'v2', 'j', 'a'], ['m', 'w2', 'j', 'a']]);
  va.startSim();
  check('Motor 6 pontas: ligação estrela reconhecida', M6().run && M6().conn === 'estrela');
  va.stopSim();
  mk([['f', 'fonte_3f', 'X1'], ['m', 'motor_6p', 'M1']],
     [['f', 'l1', 'm', 'u1'], ['f', 'l2', 'm', 'v1'], ['f', 'l3', 'm', 'w1'], ['f', 'l1', 'm', 'w2'], ['f', 'l2', 'm', 'u2'], ['f', 'l3', 'm', 'v2']]);
  va.startSim();
  check('Motor 6 pontas: ligação triângulo reconhecida', M6().run && M6().conn === 'triângulo');
  va.stopSim();

  mk([['f', 'fonte_3f', 'X1'], ['j', 'juncao', '']], [['f', 'l1', 'j', 'a'], ['f', 'l2', 'j', 'a']]);
  va.startSim();
  check('Curto entre fases L1 e L2 detectado', !va.sim.running && /L1 e L2/.test(document.getElementById('banner').textContent));

  mk([['f', 'fonte_3f', 'X1'], ['r', 'rff', 'KF1'], ['l', 'fase', ''], ['n', 'neutro', ''], ['h', 'sinaleiro', 'H1']],
     [['f', 'l1', 'r', 'l1'], ['f', 'l2', 'r', 'l2'], ['f', 'l3', 'r', 'l3'], ['l', 'a', 'r', 'c15'], ['r', 'c18', 'h', 'a'], ['h', 'b', 'n', 'a']]);
  va.startSim();
  check('Relé de falta de fase: três fases presentes fecha 15-18', lit('H1'));
  va.doc().wires = va.doc().wires.filter(w => !(w.b.t === 'l3' && w.b.c === 'r')); va.solve();
  check('Relé de falta de fase: falta de L3 abre 15-18', !lit('H1'));
  va.stopSim();

  mk([['l', 'fase', ''], ['n', 'neutro', ''], ['g', 'fonte_24', 'G1'], ['k', 'bobina', 'K9']],
     [['l', 'a', 'g', 'i1'], ['n', 'a', 'g', 'i2'], ['g', 'o1', 'k', 'a'], ['g', 'o2', 'k', 'b']]);
  va.startSim();
  check('Fonte 24 Vcc alimenta bobina em corrente contínua', va.sim.coils.K9 && va.sim.running);
  va.stopSim();

  mk([['l', 'fase', ''], ['n', 'neutro', ''], ['ks', 'rele_seguranca', 'KS1'], ['e', 'emergencia', 'SE1'], ['r', 'botao_na', 'R1'], ['h', 'sinaleiro', 'H1']],
     [['l', 'a', 'ks', 'a1'], ['ks', 'a2', 'n', 'a'], ['ks', 's11', 'e', 'a'], ['e', 'b', 'ks', 's12'], ['ks', 's33', 'r', 'a'], ['r', 'b', 'ks', 's34'],
      ['l', 'a', 'ks', 'o13'], ['ks', 'o14', 'h', 'a'], ['h', 'b', 'n', 'a']]);
  va.startSim();
  check('Relé de segurança: aguarda rearme ao energizar', !lit('H1'));
  press('R1');
  check('Relé de segurança: rearme fecha 13-14', lit('H1'));
  va.interact(va.doc().comps.find(c => c.id === 'e'));
  check('Relé de segurança: emergência abre a saída', !lit('H1'));
  va.interact(va.doc().comps.find(c => c.id === 'e'));
  check('Relé de segurança: soltar a emergência exige novo rearme', !lit('H1'));
  va.stopSim();

  mk([['l', 'fase', ''], ['n', 'neutro', ''], ['o', 'cabo_out', 'W1'], ['i', 'cabo_in', 'W1'], ['h', 'sinaleiro', 'H1']],
     [['l', 'a', 'o', 'a'], ['i', 'a', 'h', 'a'], ['h', 'b', 'n', 'a']]);
  va.startSim();
  check('Segmentos de cabo OUT/IN com a mesma tag ficam ligados', lit('H1'));
  va.stopSim();

  check('Biblioteca com 43 componentes', Object.keys(va.TYPES).length === 43);
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

// Folhas, navegação e painel de operação
await p.click('#bRun'); await p.evaluate(() => window.__va.setView('diagram'));
const sheetsBefore = await p.evaluate(() => window.__va.doc().sheets.length);
await p.click('#sNew');
results.push(['Folhas: Nova folha cria uma folha', await p.evaluate(n => window.__va.doc().sheets.length === n + 1, sheetsBefore)]);
await p.click('#sDel'); await p.click('#dConfirm');
results.push(['Folhas: Apagar remove a folha', await p.evaluate(n => window.__va.doc().sheets.length === n, sheetsBefore)]);
const cross = await p.evaluate(() => {
  const va = window.__va; va.load(va.EXAMPLES[1].build()); va.startSim();
  const s1 = va.doc().comps.find(c => c.tag === 'S1');
  const m = va.doc().comps.find(c => c.type === 'motor_3f');
  va.sim.pressed.add(s1.id); va.solve(); va.sim.pressed.clear(); va.solve();
  const ok = s1.sheet !== m.sheet && va.sim.motors[m.id].run;
  va.render();
  return { ok, flow: document.querySelectorAll('#cv .wflow').length };
});
results.push(['Folhas: botão na folha 2 liga o motor da folha 1 via segmentos de cabo', cross.ok]);
results.push(['Corrente animada nos fios energizados', cross.flow > 0]);
await p.click('[data-nav="monitor"]');
results.push(['Monitoramento: registro de eventos preenchido', await p.locator('.events li').count() > 1]);
await p.click('#moRun'); await p.click('[data-nav="operate"]'); await p.click('#opRun');
const op = p.locator('.opbtn.push').filter({ hasText: 'S1' }).first();
const ob = await op.boundingBox();
await p.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(80);
results.push(['Operação: botão do painel aciona K1 com selo', await p.evaluate(() => !!window.__va.sim.coils.K1)]);
await p.click('[data-nav="home"]');
results.push(['Início: exemplos com miniatura', await p.locator('.excard .thumb').count() === 4]);

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

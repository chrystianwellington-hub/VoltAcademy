// Testes do motor de simulação e da interface com Playwright.
// Uso: node scripts/build-standalone.mjs && node tests/simulacao.test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../dist/VoltAcademy-Comandos-Eletricos.html')).href;
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
// The bottom navigation auto-collapses in the diagram (Auto Focus Mode); expand it before clicking.
const openPanel = async pg => { await pg.evaluate(() => { const va = window.__va; va.ui.inspOpen = true; va.ui.pmTab = 'proj'; va.render(); }); await pg.waitForTimeout(400); };
const nav = async (pg, v) => { await pg.evaluate(() => { const va = window.__va; if (va.focus.navigationExpanded) va.toggleNavigation(); va.toggleNavigation(); }); await pg.waitForTimeout(380); await pg.click(`[data-nav="${v}"]`); };
p.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await p.goto(page);
await p.waitForTimeout(600);
const startsHome = await p.evaluate(() => window.__va.ui.view === 'home' && !document.getElementById('vHome').hidden);
await p.evaluate(() => window.__va.setView('diagram'));

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

  // ---- Medições, curto com proteção, sobrecarga ----
  const step = secs => { for (let i = 0; i < secs * 10; i++) { va.sim.t += 0.1; if (va.updateElectrical(0.1)) { va.solve(); va.updateElectrical(0); } } };
  va.load(va.EXAMPLES[1].build()); va.startSim(); press('S1');
  step(3);
  const mot = va.doc().comps.find(c => c.type === 'motor_3f');
  check('Medição: 220 V fase-neutro, 380 V fase-fase e 60 Hz', va.sim.meas.v1 === 220 && va.sim.meas.v3 === 380 && va.sim.meas.hz === 60);
  check('Medição: corrente do motor de 1,5 kW perto de 3,15 A em regime', Math.abs(va.sim.meas.motors[mot.id] - 3.15) < 0.2);
  va.sim.overload.add(mot.id); step(6);
  check('Sobrecarga: relé térmico dispara sozinho e derruba K1', va.sim.tripped.has('FT1') && !va.sim.coils.K1 && va.sim.events.some(e => /Sobrecarga/.test(e.msg)));
  va.clearFaults(); press('S1'); step(2);
  va.sim.injShort.add(mot.id); va.solve();
  const q1 = va.doc().comps.find(c => c.tag === 'Q1');
  check('Curto no motor: disjuntor-motor Q1 desarma e a simulação continua', va.sim.running && va.sim.toggled.has(q1.id) && va.sim.faults[q1.id] && !va.sim.motors[mot.id].run);
  va.clearFaults();
  check('Rearmar proteções limpa as falhas', !Object.keys(va.sim.faults).length && !va.sim.toggled.has(q1.id));
  va.stopSim();
  va.load(va.EXAMPLES[0].build()); va.startSim(); press('S1');
  const k1c = va.doc().comps.find(c => c.type === 'bobina');
  va.sim.injShort.add(k1c.id); va.solve();
  const qc = va.doc().comps.find(c => c.tag === 'Q1');
  check('Curto na bobina: disjuntor do comando desarma', va.sim.running && va.sim.toggled.has(qc.id) && va.sim.events.some(e => /Curto-circuito/.test(e.msg) && /Q1 desarmou/.test(e.msg)));
  va.stopSim();

  // ---- Numeração de fios por ponto elétrico ----
  const netsOK = () => {
    const d = va.doc(), par = {}, f = k => { while (par[k] && par[k] !== k) k = par[k]; return k; }, u = (a, b) => { const ra = f(a), rb = f(b); if (ra !== rb) par[ra] = rb; };
    for (const w of d.wires) { par[w.a.c + w.a.t] = par[w.a.c + w.a.t] || w.a.c + w.a.t; par[w.b.c + w.b.t] = par[w.b.c + w.b.t] || w.b.c + w.b.t; u(w.a.c + w.a.t, w.b.c + w.b.t); }
    const byNet = {}; for (const w of d.wires) (byNet[f(w.a.c + w.a.t)] = byNet[f(w.a.c + w.a.t)] || new Set()).add(String(w.no));
    const nos = Object.values(byNet).map(s => [...s]);
    return { uniform: nos.every(s => s.length === 1), unique: new Set(nos.map(s => s[0])).size === nos.length, nets: nos.length, wires: d.wires.length };
  };
  va.load(va.EXAMPLES[0].build());
  { const r = netsOK(); check('Números de fio: mesmo ponto de conexão mantém o mesmo número', r.uniform && r.nets < r.wires); check('Números de fio: pontos diferentes têm números diferentes', r.unique); }
  va.load(va.EXAMPLES[1].build());
  { const d = va.doc(), no = tg => d.wires.find(w => [w.a.c, w.b.c].includes(d.comps.find(c => c.type === tg[0] && c.tag === tg[1]).id)).no;
    check('Números de fio: segmento de cabo leva o mesmo número para a outra folha', no(['cabo_out', 'W1']) === no(['cabo_in', 'W1']) && no(['cabo_out', 'W2']) === no(['cabo_in', 'W2'])); }

  check('Biblioteca com 57 componentes (inclui transformadores, boias, fins de curso, fotocélulas e TOF)', Object.keys(va.TYPES).length === 57);
  return out;
});

// Interação real com o mouse: segurar S1 durante a simulação
await p.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); document.getElementById('bFit').click(); });
await p.click('#bRun');
const id = await p.evaluate(() => window.__va.doc().comps.find(c => c.tag === 'S1').id);
const bb = await p.evaluate(i => { const r = document.querySelector(`[data-comp="${i}"] .chit`).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, id);
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.mouse.down(); await p.waitForTimeout(100);
results.push(['Mouse: segurar S1 liga K1', await p.evaluate(() => !!window.__va.sim.coils.K1)]);
await p.mouse.up(); await p.waitForTimeout(100);
results.push(['Mouse: soltar S1 mantém K1 (selo)', await p.evaluate(() => !!window.__va.sim.coils.K1)]);

// Folhas, navegação e painel de operação
await p.click('#bRun'); await p.evaluate(() => window.__va.setView('diagram'));
const sheetsBefore = await p.evaluate(() => window.__va.doc().sheets.length);
await openPanel(p); await p.click('#sNew'); await p.click('#dSave');
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
await nav(p, 'monitor');
results.push(['Monitoramento: registro de eventos preenchido', await p.locator('.events li').count() > 1]);
await p.click('#moRun'); await nav(p, 'operate'); await p.click('#opRun');
const op = p.locator('.opbtn.push').filter({ hasText: 'S1' }).first();
const ob = await op.boundingBox();
await p.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); await p.waitForTimeout(80);
results.push(['Operação: botão do painel aciona K1 com selo', await p.evaluate(() => !!window.__va.sim.coils.K1)]);
await nav(p, 'home');
results.push(['Início: abre na tela holográfica do VOLT CORE', startsHome]);
results.push(['Início: carrossel com 5 operações a 72°', await p.evaluate(() => window.__va.HOME_OPS.length === 5 && document.querySelectorAll('#opDots .hdot').length === 5 && window.__va.HOME_OPS[4].id === 'exercicios')]);
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(950);
results.push(['Início: seta gira o carrossel e o núcleo reage', await p.evaluate(() => { const H = window.__va.Home; return H.sel === 3 && Math.abs(H.rot - 3 * 2 * Math.PI / 5) < 0.05 && /Exemplos/.test(document.getElementById('opTitle').textContent); })]);
await p.evaluate(() => window.__va.homeSelect(3)); await p.waitForTimeout(950);
await p.click('#opGo'); await p.waitForTimeout(700);
results.push(['Início: confirmar Exemplos abre o Project Lab com a biblioteca real', await p.evaluate(() => window.__va.ui.view === 'lab' && document.querySelectorAll('#labList .lab-item').length === window.__va.EXAMPLES.length && window.__va.EXAMPLES.length === 15)]);
await p.click('#labList [data-lab="1"]'); await p.waitForTimeout(2900);
results.push(['Lab: projeto se materializa a partir dos dados reais', await p.evaluate(() => { const L = window.__va.Lab; return L.sel === 1 && L.build > 0.99 && L.geo.segs.filter(s => s.kind === 'wire').length >= 15 && L.geo.labels.some(l => l.text === 'M1') && L.core.state === 'PREVIEW'; })]);
results.push(['Lab: só o projeto ativo acende', await p.evaluate(() => document.querySelectorAll('#labList .energy-active').length === 1)]);
results.push(['Lab: modos sem dados ficam indisponíveis com o motivo', await p.evaluate(() => ['uni', 'comp3d', 'ind3d', 'explode'].every(m => document.querySelector(`[data-mode2="${m}"]`).classList.contains('off')))]);
await p.click('[data-mode2="2d"]');
results.push(['Lab: Multifilar 2D mostra a folha técnica original', await p.evaluate(() => !document.getElementById('lab2d').hidden && !!document.querySelector('#lab2d svg .stamp'))]);
await p.click('[data-mode2="holo"]');
await p.click('#labOpenBtn'); await p.waitForTimeout(1300);
results.push(['Lab: ABRIR PROJETO carrega o exemplo no simulador', await p.evaluate(() => window.__va.ui.view === 'diagram' && window.__va.doc().project === 'Partida direta: força e comando' && window.__va.doc().sheets.length === 2)]);

await p.evaluate(() => { const va = window.__va; if (va.sim.running) va.stopSim(); va.load(va.EXAMPLES[1].build()); va.setView('diagram'); });
await openPanel(p); await p.click('[data-look="2d"]');
await p.click('[data-folder="Proteção"]');
results.push(['Modo 2D: componentes desenhados como equipamentos', await p.evaluate(() => document.querySelectorAll('#cv .d2').length >= 5 && document.querySelectorAll('.part .d2').length >= 8)]);
await p.click('[data-folder="Proteção"]');
await p.click('#bRun');
await p.evaluate(() => { const va = window.__va; const s1 = va.doc().comps.find(c => c.tag === 'S1'); va.sim.pressed.add(s1.id); va.solve(); va.sim.pressed.clear(); va.solve(); });
await p.waitForTimeout(1500);
await nav(p, 'monitor'); await p.waitForTimeout(300);
results.push(['Monitoramento: gráficos com dados e leituras de V, A e Hz', await p.evaluate(() => window.__va.sim.series.length > 5 && /220/.test(document.getElementById('moTiles').textContent) && /60 Hz/.test(document.getElementById('moTiles').textContent))]);
const fbtn = p.locator('[data-fault^="short:"]').first(); await fbtn.click(); await p.waitForTimeout(400);
results.push(['Monitoramento: botão de falha provoca curto e a proteção atua', await p.evaluate(() => window.__va.sim.running && Object.keys(window.__va.sim.faults).length > 0)]);
await nav(p, 'diagram'); await openPanel(p); await p.click('[data-look="sym"]');

// ---- Fios: arrastar para ligar, rota automática, alças, editor, relatório, som ----
await p.evaluate(() => { const va = window.__va; if (va.sim.running) va.stopSim(); va.ui.look = 'sym'; va.load({ project: 'Fios', sheets: [{ id: 's1', name: 'Comando' }],
  comps: [{ id: 'c1', type: 'fase', x: 300, y: 100, tag: '', phase: 'L1', sheet: 's1' }, { id: 'c2', type: 'sirene', x: 300, y: 500, tag: 'HA1', sheet: 's1' },
          { id: 'c3', type: 'bobina', x: 300, y: 300, tag: 'K9', sheet: 's1' }, { id: 'c4', type: 'neutro', x: 300, y: 700, tag: '', sheet: 's1' }], wires: [] });
  va.setView('diagram'); document.getElementById('bFit').click(); });
const tp = sel => p.evaluate(q => { const r = document.querySelector(q).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
let [ax, ay] = await tp('[data-term="c1|a"]'); let [bx, by] = await tp('[data-term="c2|a"]');
await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx + 6, by + 5, { steps: 4 }); await p.mouse.up();
const w1 = await p.evaluate(() => { const va = window.__va, w = va.doc().wires[0]; return w && { no: w.no, pts: w.pts.length, P: va.points(w.id) }; });
results.push(['Fio: arrastar de um borne a outro cria o fio numerado (ímã no borne)', !!w1 && w1.no === 1]);
results.push(['Fio: rota automática desvia da bobina no caminho', !!w1 && w1.P.length > 2 && w1.P.every(([x]) => x === 300) === false]);
[ax, ay] = await tp('[data-term="c2|b"]'); [bx, by] = await tp('[data-term="c4|a"]');
await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up();
results.push(['Fio: segundo fio recebe o número 2', await p.evaluate(() => window.__va.doc().wires[1] && window.__va.doc().wires[1].no === 2)]);
const hb = await p.evaluate(() => { const va = window.__va; va.ui.sel = { kind: 'wire', id: va.doc().wires[0].id }; va.render(); const h = document.querySelector('.whandle'); const r = h.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0] + 60, hb[1] + 60, { steps: 5 }); await p.mouse.up();
results.push(['Fio: arrastar a alça reposiciona o trecho e mantém os bornes', await p.evaluate(() => { const va = window.__va, w = va.doc().wires[0], P = va.points(w.id); return w.pts.length > 0 && P[0][0] === 300 && P[0][1] === 120 && P[P.length - 1][1] === 460; })]);
await p.evaluate(() => { const el = document.querySelector('.wno'); el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
results.push(['Fio: duplo clique abre o editor com bitola', await p.locator('#wSec').count() === 1]);
await p.selectOption('#wKind', 'potencia'); await p.selectOption('#wSec', '16'); await p.click('#wSave');
results.push(['Fio: seção de 16 mm² salva no fio', await p.evaluate(() => { const w = window.__va.doc().wires.find(x => x.no === 1); return w.section === 16 && w.kind === 'potencia'; })]);
await nav(p, 'tags');
results.push(['Relatório: lista de fios e resumo por bitola', /16 mm²/.test(await p.locator('#vTags').textContent()) && await p.locator('#vTags tbody tr').count() >= 4]);
await nav(p, 'diagram'); await p.click('#bRun'); await p.waitForTimeout(300);
results.push(['Som: sirene energizada toca', await p.evaluate(() => { const va = window.__va; return Object.values(va.sim.lamps).some(Boolean) && Object.keys(va.audio.voices).length === 1; })]);
await p.click('#bSound'); await p.waitForTimeout(150);
results.push(['Som: botão Mudo silencia os alarmes', await p.evaluate(() => Object.keys(window.__va.audio.voices).length === 0)]);
await p.click('#bSound'); await p.click('#bRun');

// ---- Configurar folha: formato, grade e logo; edição de número por ponto ----
await p.evaluate(() => { const va = window.__va; if (va.sim.running) va.stopSim(); va.load(va.EXAMPLES[0].build()); va.setView('diagram'); });
const net = await p.evaluate(() => { const d = window.__va.doc(), s0 = d.comps.find(c => c.tag === 'S0'); return d.wires.filter(w => (w.a.c === s0.id && w.a.t === 'b') || (w.b.c === s0.id && w.b.t === 'b')).map(w => w.id); });
await p.evaluate(id => { window.__va.ui.sel = { kind: 'wire', id }; window.__va.render(); document.querySelector('.wno.sel').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }, net[0]);
await p.fill('#wNo', '50'); await p.click('#wSave');
results.push(['Números de fio: mudar o número altera todos os fios do mesmo ponto', await p.evaluate(ids => ids.every(id => window.__va.doc().wires.find(w => w.id === id).no === 50), net)]);
const other = await p.evaluate(ids => window.__va.doc().wires.find(w => !ids.includes(w.id)).id, net);
await p.evaluate(id => { window.__va.ui.sel = { kind: 'wire', id }; window.__va.render(); document.querySelector('.wno.sel').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }, other);
await p.fill('#wNo', '50'); await p.click('#wSave');
results.push(['Números de fio: número de outro ponto é recusado', /outro ponto/.test(await p.locator('#wMsg').textContent())]);
await p.click('[data-close]');
await openPanel(p); await p.click('#sCfg');
await p.selectOption('#dSize', 'A4'); await p.selectOption('#dOrient', 'retrato'); await p.fill('#dCols', '8'); await p.fill('#dRows', '10');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4EIwDiqkL4KAQBLMQf/2mcV5gAAAABJRU5ErkJggg==', 'base64');
await p.setInputFiles('#dLogo', { name: 'logo.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(300);
await p.uncheck('#dAuto'); await p.fill('#dDate', '2026-12-01');
await p.click('#dSave'); await p.waitForTimeout(200);
results.push(['Folha: A4 retrato com 8 colunas e 10 linhas', await p.evaluate(() => { const s = window.__va.doc().sheets[0]; const r = document.querySelector('#bgHit rect'); return s.size === 'A4' && s.orient === 'retrato' && s.cols === 8 && s.rows === 10 && r.getAttribute('width') === '840' && r.getAttribute('height') === '1188'; })]);
results.push(['Folha: logo e data manual no carimbo', await p.evaluate(() => /^data:image\/png/.test(window.__va.doc().logo) && !!document.querySelector('.stamp image') && /01\/12\/2026/.test(document.querySelector('.stamp').textContent))]);

// ---- Arquivos: salvar backup, importar (abrir/adicionar folhas) e PDF ----
await p.evaluate(() => { const va = window.__va; if (va.sim.running) va.stopSim(); va.load(va.EXAMPLES[1].build()); window.showSaveFilePicker = undefined; va.setView('diagram'); });
await p.click('#bFile');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pSave')]);
const saved = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8');
const sj = JSON.parse(saved);
results.push(['Arquivo: salvar gera .voltacademy com o projeto completo', dl.suggestedFilename().endsWith('.voltacademy') && sj.format === 'voltacademy-projeto' && sj.sheets.length === 2 && sj.wires.length > 20]);
await p.keyboard.press('Escape');
await p.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); });
await p.click('#bFile'); await p.setInputFiles('#pFile', { name: 'backup.voltacademy', mimeType: 'application/json', buffer: Buffer.from(saved) });
await p.click('#iMerge');
results.push(['Arquivo: importar adiciona as folhas ao projeto atual', await p.evaluate(() => window.__va.doc().sheets.length === 3 && window.__va.doc().comps.length === 29)]);
await p.click('#bFile'); await p.setInputFiles('#pFile', { name: 'backup.voltacademy', mimeType: 'application/json', buffer: Buffer.from(saved) });
await p.click('#iOpen');
results.push(['Arquivo: abrir substitui pelo projeto salvo', await p.evaluate(() => window.__va.doc().sheets.length === 2 && window.__va.doc().comps.length === 17)]);
await p.click('#bFile'); await p.click('#pPdf');
const [dp] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#xGo')]);
const pdf = await (await import('node:fs/promises')).readFile(await dp.path());
const pagesN = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
const pdfMeta = await p.evaluate(() => window.__lastPdfMeta);
results.push(['PDF: arquivo válido com capa, índice, folhas, lista de materiais e relatório', pdf.slice(0, 5).toString() === '%PDF-' && pdf.slice(-6).toString().includes('%%EOF') && pagesN === pdfMeta.total && pdfMeta.entries.map(e => e.k).join(',') === 'cover,index,sheet,sheet,bom,report']);

// ---- Biblioteca retrátil (activeCategory) e Active Energy UI ----
const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fresh.goto(page); await fresh.waitForTimeout(500); await fresh.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('diagram'); });
results.push(['Biblioteca: começa fechada e sem categoria ativa', await fresh.evaluate(() => window.__va.ui.activeCategory === null && !document.getElementById('drawer').classList.contains('open') && !document.querySelector('.railb.act'))]);
const geo0 = await fresh.evaluate(() => ({ w: document.getElementById('cv').getBoundingClientRect().width, z: window.__va.ui.zoom, px: window.__va.ui.px }));
await fresh.click('[data-folder="Comando"]'); await fresh.waitForTimeout(350);
results.push(['Biblioteca: clicar abre só os componentes da categoria', await fresh.evaluate(() => { const parts = [...document.querySelectorAll('#folders [data-part]')].map(b => window.__va.TYPES[b.dataset.part].cat); return document.getElementById('drawer').classList.contains('open') && parts.length === 18 && parts.every(c => c === 'Comando') && !document.querySelector('details.folder'); })]);
results.push(['Biblioteca: abrir não muda tamanho, zoom nem posição do desenho', await fresh.evaluate(g => { const r = document.getElementById('cv').getBoundingClientRect(); return r.width === g.w && window.__va.ui.zoom === g.z && window.__va.ui.px === g.px; }, geo0)]);
results.push(['Energia: só a categoria ativa acende', await fresh.evaluate(() => { const on = document.querySelectorAll('#rail .energy-active'); return on.length === 1 && on[0].dataset.folder === 'Comando' && on[0].classList.contains('energy-indicator'); })]);
await fresh.click('[data-folder="Proteção"]'); await fresh.waitForTimeout(350);
results.push(['Biblioteca: outra categoria troca o conteúdo e mantém aberto', await fresh.evaluate(() => document.getElementById('drawer').classList.contains('open') && [...document.querySelectorAll('#folders [data-part]')].every(b => window.__va.TYPES[b.dataset.part].cat === 'Proteção') && document.querySelectorAll('#rail .energy-active').length === 1)]);
const before = await fresh.evaluate(() => window.__va.doc().comps.length);
const src = await fresh.evaluate(() => { const r = document.querySelector('[data-part="fusivel"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await fresh.mouse.move(src[0], src[1]); await fresh.mouse.down(); await fresh.mouse.move(src[0] + 200, src[1] + 40, { steps: 6 }); await fresh.mouse.move(900, 500, { steps: 8 }); await fresh.mouse.up(); await fresh.waitForTimeout(150);
results.push(['Biblioteca: arrastar e soltar na folha insere o componente', await fresh.evaluate(n => { const d = window.__va.doc(); return d.comps.length === n + 1 && d.comps[d.comps.length - 1].type === 'fusivel'; }, before)]);
await fresh.click('[data-folder="Proteção"]'); await fresh.waitForTimeout(350);
results.push(['Biblioteca: clicar de novo fecha e apaga a luz', await fresh.evaluate(() => window.__va.ui.activeCategory === null && !document.getElementById('drawer').classList.contains('open') && !document.querySelector('#rail .energy-active'))]);
results.push(['Energia: ferramenta, aba da folha e navegação ativas acesas', await fresh.evaluate(() => ['.tool.act', '.srow.act', '.nav.act'].every(q => { const e = document.querySelector(q); return e && e.classList.contains('energy-active'); }) && document.querySelectorAll('.tools .energy-active').length === 1)]);
await fresh.close();

// ---- Electrical Voltage Engine (testes 01–24) ----
const ev = await browser.newPage({ viewport: { width: 1440, height: 900 } });
ev.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await ev.goto(page); await ev.waitForTimeout(400);
const elecResults = await ev.evaluate(() => {
  const va = window.__va, out = [], sim = va.sim;
  const check = (name, cond) => out.push([name, !!cond]);
  let n = 0;
  const C = (id, type, extra = {}) => ({ id, type, x: 200 + (n++ % 6) * 160, y: 200 + Math.floor(n / 6) * 200, rot: 0, tag: extra.tag || id.toUpperCase(), sheet: extra.sheet || 's1', ...extra });
  const run = (elec, comps, wires, sheets) => {
    if (sim.running) va.stopSim();
    va.load({ project: 't', elec, sheets: sheets || [{ id: 's1', name: 'F1' }], comps, wires: wires.map(([a, at, b, bt], i) => ({ id: 'w' + i, a: { c: a, t: at }, b: { c: b, t: bt }, color: '#000', pts: [] })) });
    va.startSim(); return sim;
  };
  const V = id => sim.applied[id] ? sim.applied[id].v : 0;
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
  const has = (code, id) => (sim.diag || []).some(d => d.code === code && (!id || (d.comp && d.comp.id === id)));
  const net = (v, nt = '3f_n') => ({ net: nt, v, hz: 60 });
  const coil = (vn, extra = {}) => C('k1', 'bobina', { tag: 'K1', vn, vk: 'CA', ...extra });
  const src = () => C('f1', 'fonte_3f', { tag: 'X1' });
  // 01–06: Y networks
  run(net(127), [src(), coil(127)], [['f1', 'l1', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  check('Tensão 01: rede 127/220 V, L1 + N = 127 V', near(V('k1'), 127) && sim.coils.K1);
  run(net(127), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'l2', 'k1', 'b']]);
  check('Tensão 02: rede 127/220 V, L1 + L2 = 220 V (fasorial, não 254 V)', near(V('k1'), 220) && sim.coils.K1);
  run(net(380), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  check('Tensão 03: rede 220/380 V, L1 + N ≈ 220 V', near(V('k1'), 220, 1.5) && sim.coils.K1);
  run(net(380), [src(), coil(380)], [['f1', 'l1', 'k1', 'a'], ['f1', 'l2', 'k1', 'b']]);
  check('Tensão 04: rede 220/380 V, L1 + L2 = 380 V', near(V('k1'), 380));
  run(net(440), [src(), coil(254)], [['f1', 'l1', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  check('Tensão 05: rede 254/440 V, L1 + N ≈ 254 V', near(V('k1'), 254, 1.5));
  run(net(440), [src(), coil(440)], [['f1', 'l1', 'k1', 'a'], ['f1', 'l2', 'k1', 'b']]);
  check('Tensão 06: rede 440 V, L1 + L2 = 440 V', near(V('k1'), 440));
  // 07: no neutral
  run(net(380, '3f'), [C('l', 'fase', { phase: 'L1', tag: '' }), C('nn', 'neutro', { tag: '' }), coil(220)], [['l', 'a', 'k1', 'a'], ['nn', 'a', 'k1', 'b']]);
  check('Tensão 07: rede sem neutro, usar N gera aviso e não aciona', has('nunavail') && !sim.coils.K1 && va.ElectricalDiagnostics.static().some(d => d.code === 'nunavail'));
  // 08: same phase on both terminals
  run(net(380), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'l1', 'k1', 'b']]);
  check('Tensão 08: mesma fase nos dois terminais = 0 V', V('k1') === 0 && !sim.coils.K1 && !sim.short);
  // 09–11, 14: transformer 440/220
  const T = (extra = {}) => C('t1', 'trafo_1f', { tag: 'T1', vp: 440, vs: 220, va: 500, tol: 5, ...extra });
  const txW = [['f1', 'l1', 't1', 'h1'], ['f1', 'l2', 't1', 'h2'], ['t1', 'x1', 'k1', 'a'], ['t1', 'x2', 'k1', 'b']];
  run(net(440), [src(), T(), coil(220)], txW);
  check('Tensão 09: transformador 440/220 V com 440 V entrega 220 V', near(V('k1'), 220, .5) && sim.coils.K1 && !has('txprim'));
  const ftx = va.ElectricalDomainManager.list().find(d => d.id === 't1');
  check('Tensão 14: transformador isolado não tem continuidade galvânica com o primário',
    sim.vecOf('f1', 'n') && sim.vecOf('t1', 'x2') && sim.vecOf('f1', 'n').fr !== sim.vecOf('t1', 'x2').fr && sim.uf('f1:n') !== sim.uf('t1:x2') && /isolado/.test(ftx.iso));
  run(net(380), [src(), T(), coil(220)], txW);
  check('Tensão 10: 440/220 V alimentado com 380 V → 190 V teóricos e aviso', near(V('k1'), 190, .5) && has('txprim', 't1'));
  sim.toggled.add('f1'); va.solve();
  check('Tensão 11: transformador desenergizado não gera tensão no secundário', !sim.tx.t1 && !V('k1') && !sim.coils.K1);
  // 12–13: coil ratings
  run(net(440), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'l2', 'k1', 'b']]);
  const ov = (sim.diag || []).find(d => d.code === 'over');
  check('Tensão 12: bobina 220 VCA em 440 VCA gera diagnóstico de sobretensão', ov && /SOBRETENSÃO/.test(ov.title) && ov.rows.some(r => /440/.test(r[1])));
  run(net(380), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  check('Tensão 13: bobina 220 VCA entre L1 e N de 220/380 V é compatível', sim.coils.K1 && !(sim.diag || []).length);
  // 15–16: AC/DC supply
  const psu = C('g1', 'fonte_24', { tag: 'G1', vout: 24 });
  const psW = [['f1', 'l1', 'g1', 'i1'], ['f1', 'n', 'g1', 'i2'], ['g1', 'o1', 'k1', 'a'], ['g1', 'o2', 'k1', 'b']];
  run(net(380), [src(), psu, coil(24, { vk: 'CC' })], psW);
  check('Tensão 15: fonte CA/CC de 24 V entrega corrente contínua', sim.psu.g1 && sim.applied.k1 && sim.applied.k1.kind === 'CC' && near(V('k1'), 24, .1) && sim.coils.K1);
  run(net(380), [src(), psu, coil(24, { vk: 'CA' })], psW);
  check('Tensão 16: bobina só CA não opera em CC de mesmo valor', !sim.coils.K1 && has('acdc', 'k1'));
  // 17: across sheets
  const sh2 = [{ id: 's1', name: 'Força' }, { id: 's2', name: 'Comando' }];
  run(net(440), [src(), T(), C('o1', 'cabo_out', { tag: 'W1' }), C('o2', 'cabo_out', { tag: 'W2' }), C('i1', 'cabo_in', { tag: 'W1', sheet: 's2' }), C('i2', 'cabo_in', { tag: 'W2', sheet: 's2' }), coil(220, { sheet: 's2' })],
    [['f1', 'l1', 't1', 'h1'], ['f1', 'l2', 't1', 'h2'], ['t1', 'x1', 'o1', 'a'], ['t1', 'x2', 'o2', 'a'], ['i1', 'a', 'k1', 'a'], ['i2', 'a', 'k1', 'b']], sh2);
  check('Tensão 17: segmentos de cabo entre folhas preservam a origem e o domínio', sim.coils.K1 && near(V('k1'), 220, .5) && sim.potOf('k1', 'a') === 't1|x1' && sim.vecOf('k1', 'a').fr === sim.vecOf('t1', 'x1').fr && va.ElectricalDomainManager.list().length === 2);
  // 19: persistence
  run(net(440, '3f'), [src(), T({ va: 750 }), C('t3', 'trafo_3f_iso', { tag: 'T3', vp: 440, vs: 380, conn: 'Dy', nsec: true }), coil(220)], txW);
  va.stopSim(); const js = va.serialize(); va.load(js); const d2 = va.doc();
  check('Tensão 19: rede e transformadores preservados ao salvar e reabrir', d2.elec.net === '3f' && d2.elec.v === 440 && d2.comps.find(c => c.id === 't1').va === 750 && d2.comps.find(c => c.id === 't3').conn === 'Dy' && JSON.parse(js).elec.v === 440);
  // 20–21: open circuits
  run(net(380), [src(), coil(220)], [['f1', 'l1', 'k1', 'a']]);
  check('Tensão 20: bobina com circuito aberto não aciona com fase num terminal', !sim.coils.K1 && !V('k1'));
  run(net(380), [src(), C('s1', 'botao_na', { tag: 'S1' }), coil(220)], [['f1', 'l1', 's1', 'a'], ['s1', 'b', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  const openOk = !sim.coils.K1 && !V('k1'); sim.pressed.add('s1'); va.solve(); const closedOk = sim.coils.K1; sim.pressed.clear(); va.solve();
  check('Tensão 21: contato aberto interrompe a propagação', openOk && closedOk && !sim.coils.K1);
  // 22: single-phase 127 V
  run(net(127, '1f'), [C('l1', 'fase', { phase: 'L1', tag: '' }), C('l2', 'fase', { phase: 'L2', tag: '' }), coil(220)], [['l1', 'a', 'k1', 'a'], ['l2', 'a', 'k1', 'b']]);
  check('Tensão 22: rede monofásica 127 V não fornece 220 V', !sim.coils.K1 && !V('k1') && has('funavail'));
  // 23: phase-to-phase direct connection
  run(net(380), [C('l1', 'fase', { phase: 'L1', tag: '' }), C('l2', 'fase', { phase: 'L2', tag: '' })], [['l1', 'a', 'l2', 'a']]);
  check('Tensão 23: fases ligadas diretamente = curto-circuito', !sim.running && /L1 e L2/.test(document.getElementById('banner').textContent));
  // 24: 440 V Y network does not give 220 V F-N
  run(net(440), [src(), coil(220)], [['f1', 'l1', 'k1', 'a'], ['f1', 'n', 'k1', 'b']]);
  check('Tensão 24: rede 440 V com neutro dá 254 V F-N, não 220 V', near(V('k1'), 254, 1.5) && has('over', 'k1'));
  // extras: 3-phase transformer, autotransformer, motor rotation, legacy default
  run(net(440), [src(), C('t3', 'trafo_3f_iso', { tag: 'T3', vp: 440, vs: 380, conn: 'Dy', nsec: true }), coil(220), C('m1', 'motor_3f', { tag: 'M1', vn: 380 })],
    [['f1', 'l1', 't3', 'h1'], ['f1', 'l2', 't3', 'h2'], ['f1', 'l3', 't3', 'h3'], ['t3', 'x1', 'k1', 'a'], ['t3', 'x0', 'k1', 'b'], ['t3', 'x1', 'm1', 'u'], ['t3', 'x2', 'm1', 'v'], ['t3', 'x3', 'm1', 'w']]);
  check('Transformador trifásico Dyn11 440/380 V: X1–X0 ≈ 220 V e motor gira', near(V('k1'), 220, 1.5) && sim.motors.m1.run && near(V('m1'), 380, 1));
  run(net(220, '1f'), [C('l', 'fase', { phase: 'L1', tag: '' }), C('nn', 'neutro', { tag: '' }), C('a1', 'autotrafo', { tag: 'T1', vp: 220, vs: 127 }), coil(127)],
    [['l', 'a', 'a1', 'h1'], ['nn', 'a', 'a1', 'c'], ['a1', 'x1', 'k1', 'a'], ['nn', 'a', 'k1', 'b']]);
  check('Autotransformador 220/127 V: saída 127 V sem isolamento (mesmo domínio da rede)', near(V('k1'), 127, .5) && sim.vecOf('k1', 'a').fr === sim.vecOf('l', 'a').fr);
  if (sim.running) va.stopSim();
  va.load(va.EXAMPLES[0].build());
  check('Projetos antigos sem rede usam o padrão 220/380 V 60 Hz', !va.doc().elec && va.ElectricalNetwork.label() === '220/380 V · 3F + N · 60 Hz');
  return out;
});
results.push(...elecResults);

// ---- Configurar novo projeto (VOLT CORE → Criar projeto) ----
await ev.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[2].build()); va.setView('home'); va.homeSelect(2); });
const projBefore = await ev.evaluate(() => window.__va.serialize());
await ev.evaluate(() => window.__va.homeConfirm()); await ev.waitForTimeout(800);
results.push(['Novo projeto: Criar projeto abre "Configurar novo projeto" sobre a tela inicial', await ev.evaluate(() => !document.getElementById('modal').hidden && /Configurar novo projeto/.test(document.getElementById('sheet').textContent) && window.__va.ui.view === 'home')]);
results.push(['Novo projeto: campos da folha e as quatro tensões disponíveis', await ev.evaluate(() => ['dLogo', 'dSize', 'dOrient', 'dCols', 'dRows', 'dName', 'dDesc', 'dAuth', 'dProj', 'dDate', 'dAuto', 'dAll'].every(id => document.getElementById(id)) &&
  [...document.querySelectorAll('[data-ev]')].map(b => +b.dataset.ev).join() === '127,220,380,440' && document.querySelectorAll('[data-enet]').length === 4 && document.querySelectorAll('[data-ehz]').length === 2)]);
await ev.click('#dCloseCfg'); await ev.waitForTimeout(400);
results.push(['Novo projeto: Fechar cancela e não sobrescreve o projeto atual', await ev.evaluate(p0 => document.getElementById('modal').hidden && window.__va.ui.view === 'home' && window.__va.serialize() === p0, projBefore)]);
await ev.evaluate(() => window.__va.homeConfirm()); await ev.waitForTimeout(800);
await ev.click('#dSkip'); await ev.waitForTimeout(500);
results.push(['Tensão 18: Pular configuração usa os padrões do software', await ev.evaluate(() => { const va = window.__va, d = va.doc(); return va.ui.view === 'diagram' && !d.elec && d.sheets.map(s => s.name).join() === 'Força,Comando' && d.comps.length === 0 && d.sheets[0].size === 'A3' && va.ElectricalNetwork.label() === '220/380 V · 3F + N · 60 Hz'; })]);
await ev.evaluate(() => { window.__va.setView('home'); window.__va.homeSelect(2); window.__va.homeConfirm(); }); await ev.waitForTimeout(800);
await ev.click('[data-ev="440"]'); await ev.click('[data-enet="3f_n"]'); await ev.click('[data-ehz="50"]');
const prev440 = await ev.evaluate(() => document.getElementById('ePrev').textContent);
await ev.fill('#dProj', 'Prensa 440'); await ev.fill('#dAuth', 'Aluno'); await ev.selectOption('#dSize', 'A4');
await ev.click('#dSave'); await ev.waitForTimeout(500);
results.push(['Novo projeto: prévia mostra 440 V entre fases e ≈ 254 V fase-neutro', /440 VCA/.test(prev440) && /254 VCA/.test(prev440)]);
results.push(['Novo projeto: Criar projeto aplica tensão, folhas e identificação', await ev.evaluate(() => { const va = window.__va, d = va.doc(); return va.ui.view === 'diagram' && d.elec && d.elec.v === 440 && d.elec.hz === 50 && d.elec.net === '3f_n' && d.project === 'Prensa 440' && d.author === 'Aluno' && d.sheets.every(s => s.size === 'A4') && /Prensa 440/.test(document.querySelector('.brand, header').textContent + document.getElementById('world').textContent); })]);
results.push(['Novo projeto: nova bobina nasce com a tensão de comando do projeto', await ev.evaluate(() => { const c = window.__va.addComp('bobina', 300, 300); return c.vn === 254 && c.vk === 'CA' && c.hzn === 50; })]);

// ---- Auto Focus Mode ----
await ev.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); va.setView('home'); });
await ev.waitForTimeout(450);
await ev.evaluate(() => window.__va.setView('diagram')); await ev.waitForTimeout(200);
const g0 = await ev.evaluate(() => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(); return { h: r.height, z: va.ui.zoom, px: va.ui.px, py: va.ui.py, comps: JSON.stringify(va.doc().comps), wires: JSON.stringify(va.doc().wires) }; });
results.push(['Foco: ao entrar no Diagrama a navegação aparece com o temporizador armado', await ev.evaluate(() => { const f = window.__va.focus; return f.navigationExpanded && !!f.autoCollapseTimer && f.activeView === 'diagram' && !document.querySelector('.app').classList.contains('nav-collapsed'); })]);
await ev.waitForTimeout(3000 + 600);
const g1 = await ev.evaluate(() => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(), nb = document.querySelector('nav.bottom').getBoundingClientRect(), st = document.getElementById('status').getBoundingClientRect();
  return { h: r.height, z: va.ui.zoom, px: va.ui.px, py: va.ui.py, comps: JSON.stringify(va.doc().comps), wires: JSON.stringify(va.doc().wires), navH: nb.height, stBottom: st.bottom, collapsed: !va.focus.navigationExpanded && va.focus.focusMode, statusVisible: st.height > 20 && !!document.querySelector('#statusIn .readouts'), arrowUp: document.getElementById('navToggle').classList.contains('collapsed') }; });
results.push(['Foco: navegação recolhe sozinha após 3 s', g1.collapsed && g1.navH < 1 && g1.arrowUp]);
results.push(['Foco: canvas ocupa todo o espaço liberado', g1.h > g0.h + 40 && Math.abs(g1.stBottom - 900) < 2]);
results.push(['Foco: zoom, posição, componentes e fios preservados', g1.z === g0.z && g1.px === g0.px && g1.py === g0.py && g1.comps === g0.comps && g1.wires === g0.wires]);
results.push(['Foco: barra de status continua visível com as leituras', g1.statusVisible]);
const placed = await ev.evaluate(() => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(); va.ui.placing = 'bobina'; va.ui.mode = 'select'; va.render(); return { x: r.left + va.ui.px + 600 * va.ui.zoom, y: r.top + va.ui.py + 400 * va.ui.zoom, n: va.doc().comps.length }; });
await ev.mouse.move(placed.x, placed.y); await ev.mouse.click(placed.x, placed.y); await ev.waitForTimeout(150);
results.push(['Foco: coordenadas do mouse continuam precisas após expandir o canvas', await ev.evaluate(n => { const va = window.__va, c = va.doc().comps[va.doc().comps.length - 1]; va.ui.placing = null; return va.doc().comps.length === n + 1 && c.type === 'bobina' && Math.abs(c.x - 600) <= 10 && Math.abs(c.y - 400) <= 10; }, placed.n)]);
await ev.click('#navToggle'); await ev.waitForTimeout(3000 + 600);
results.push(['Foco: expandir manualmente cancela o recolhimento automático', await ev.evaluate(() => { const f = window.__va.focus; return f.navigationExpanded && f.manualOverride && !f.autoCollapseTimer && document.querySelector('nav.bottom').getBoundingClientRect().height > 40 && !document.getElementById('navToggle').classList.contains('collapsed'); })]);
await ev.click('#navToggle'); await ev.waitForTimeout(500);
results.push(['Foco: seta recolhe manualmente', await ev.evaluate(() => !window.__va.focus.navigationExpanded)]);
await nav(ev, 'monitor'); await ev.waitForTimeout(200);
results.push(['Foco: fora do Diagrama a navegação volta ao normal e sem temporizador', await ev.evaluate(() => { const f = window.__va.focus; return f.navigationExpanded && !f.autoCollapseTimer && !f.focusMode && f.activeView === 'monitor'; })]);
results.push(['Monitoramento: domínios de alimentação listados', await ev.evaluate(() => /Rede do projeto/.test(document.getElementById('moDomains').textContent))]);
await ev.click('[data-nav="diagram"]'); await ev.evaluate(() => { window.__va.setView('tags'); window.__va.setView('diagram'); });
results.push(['Foco: voltar ao Diagrama reinicia com um único temporizador', await ev.evaluate(() => !!window.__va.focus.autoCollapseTimer && window.__va.focus.navigationExpanded)]);
await ev.waitForTimeout(3600);
results.push(['Foco: recolhe de novo após retornar ao Diagrama', await ev.evaluate(() => !window.__va.focus.navigationExpanded)]);
await ev.close();

// ---- Project Manager & Workspace ----
const pm = await browser.newPage({ viewport: { width: 1440, height: 900 } });
pm.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await pm.goto(page); await pm.waitForTimeout(400);
await pm.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); va.setView('diagram'); });
await pm.waitForTimeout(450);
const geo = () => pm.evaluate(() => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(), d = va.doc();
  return { w: r.width, z: va.ui.zoom, px: va.ui.px, py: va.ui.py, data: JSON.stringify([d.comps, d.wires, d.sheets.map(s => s.id)]), pmW: document.getElementById('pm').getBoundingClientRect().width, open: va.ui.inspOpen }; });
results.push(['Painel: segunda barra removida e folhas dentro do Painel do projeto', await pm.evaluate(() => !document.querySelector('.sheetbar') && !!document.querySelector('#pm #tabs') && !!document.querySelector('#pm [data-look="2d"]') && ['sNew', 'sCfg', 'sRen', 'sDel'].every(id => document.getElementById(id).closest('#pm')))]);
results.push(['Cabeçalho: ferramentas centralizadas na largura da tela e Painel à direita', await pm.evaluate(() => { const a = document.getElementById('topActs').getBoundingClientRect(), b = document.getElementById('bInsp').getBoundingClientRect(); return Math.abs((a.left + a.right) / 2 - innerWidth / 2) < 3 && b.right > innerWidth - 40 && a.right < b.left; })]);
const c0 = await geo();
results.push(['Painel: começa fechado, sem espaço reservado', !c0.open && c0.pmW < 1]);
await pm.click('#bInsp'); await pm.waitForTimeout(500);
const c1 = await geo();
results.push(['Painel: primeiro clique abre pela direita (300–360 px)', c1.open && c1.pmW >= 300 && c1.pmW <= 362 && await pm.evaluate(() => document.getElementById('bInsp').classList.contains('energy-active'))]);
results.push(['Painel: abrir preserva zoom, posição, componentes e fios', c1.z === c0.z && c1.px === c0.px && c1.py === c0.py && c1.data === c0.data && c1.w < c0.w - 250]);
results.push(['Painel: tabela com todas as folhas a partir do projeto real', await pm.evaluate(() => { const d = window.__va.doc(), rows = [...document.querySelectorAll('#tabs .srow')];
  return rows.length === d.sheets.length && rows.every((r, i) => r.querySelector('.sn').textContent === String(i + 1).padStart(2, '0') && r.querySelector('.snm').textContent.startsWith(d.sheets[i].name) && +r.querySelector('.sc').textContent === d.comps.filter(c => c.sheet === d.sheets[i].id).length && r.querySelector('.sf').textContent.startsWith(d.sheets[i].size)) &&
    document.querySelector('#tabs .srow.act').dataset.sheet === window.__va.ui.sheet && document.querySelector('#tabs .srow.act').classList.contains('energy-active'); })]);
await pm.click('#tabs .srow:nth-child(2)'); await pm.waitForTimeout(200);
results.push(['Painel: clicar na folha troca a folha ativa, o canvas e o indicador', await pm.evaluate(() => { const va = window.__va, s = va.doc().sheets[1]; return va.ui.sheet === s.id && document.querySelector('#tabs .srow.act').dataset.sheet === s.id && /02.Comando/.test(document.querySelector('#sheetNav .stab.act').textContent) && document.querySelectorAll('#world [data-comp]').length === va.doc().comps.filter(c => c.sheet === s.id).length; })]);
await pm.click('#sNew'); await pm.waitForTimeout(150); await pm.fill('#dName', 'Sinalização'); await pm.click('#dSave'); await pm.waitForTimeout(200);
results.push(['Painel: + Nova folha pede o nome, atualiza a tabela e seleciona a folha', await pm.evaluate(() => { const va = window.__va, d = va.doc(), s = d.sheets[d.sheets.length - 1]; return d.sheets.length === 3 && s.name === 'Sinalização' && va.ui.sheet === s.id && document.querySelectorAll('#tabs .srow').length === 3 && document.querySelector('#tabs .srow.act .snm').textContent === 'Sinalização' && /03.Sinalização/.test(document.querySelector('#sheetNav .stab.act').textContent); })]);
await pm.click('#sRen'); await pm.fill('#dName', 'Segurança'); await pm.click('#dSave'); await pm.waitForTimeout(150);
results.push(['Painel: Renomear altera a folha selecionada e a tabela', await pm.evaluate(() => document.querySelector('#tabs .srow.act .snm').textContent === 'Segurança' && window.__va.doc().sheets[2].name === 'Segurança')]);
await pm.click('#sDel'); await pm.waitForTimeout(100); await pm.click('#dConfirm'); await pm.waitForTimeout(150);
results.push(['Painel: Apagar pede confirmação e atualiza a tabela', await pm.evaluate(() => window.__va.doc().sheets.length === 2 && document.querySelectorAll('#tabs .srow').length === 2)]);
await pm.click('#tabs .srow:nth-child(1)'); await pm.click('#sDel'); await pm.waitForTimeout(100);
results.push(['Painel: Apagar mostra as referências em outras folhas antes de excluir', await pm.evaluate(() => /Referências em outras folhas/.test(document.getElementById('sheet').textContent) && /W1/.test(document.getElementById('sheet').textContent))]);
await pm.click('#sheet [data-close]'); await pm.waitForTimeout(100);
results.push(['Painel: cancelar a exclusão mantém a folha', await pm.evaluate(() => window.__va.doc().sheets.length === 2)]);
await pm.click('#sCfg'); await pm.waitForTimeout(100);
results.push(['Painel: Configurar abre a configuração da folha existente', await pm.evaluate(() => /Configurar folha/.test(document.getElementById('sheet').textContent) && !!document.getElementById('dSize'))]);
await pm.click('#sheet [data-close]'); await pm.waitForTimeout(100);
await pm.click('#pm [data-look="2d"]'); await pm.waitForTimeout(150);
results.push(['Painel: Visualização 2D usa o modo existente', await pm.evaluate(() => window.__va.ui.look === '2d' && document.querySelectorAll('#cv .d2').length > 3 && document.querySelector('#pm [data-look="2d"]').classList.contains('act'))]);
await pm.click('#pm [data-look="sym"]');
results.push(['Painel: Dados elétricos do projeto vêm da configuração', await pm.evaluate(() => { const t = document.getElementById('pmElecBody').textContent; return /220\/380 V/.test(t) && /3F \+ N/.test(t) && /60 Hz/.test(t) && /disponível/.test(t); })]);
const place = await pm.evaluate(() => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(); va.ui.placing = 'sinaleiro'; va.render(); return { x: r.left + va.ui.px + 300 * va.ui.zoom, y: r.top + va.ui.py + 300 * va.ui.zoom, n: va.doc().comps.length }; });
await pm.mouse.move(place.x, place.y); await pm.mouse.click(place.x, place.y); await pm.waitForTimeout(150);
results.push(['Painel aberto: coordenadas do mouse continuam precisas', await pm.evaluate(n => { const va = window.__va, c = va.doc().comps[va.doc().comps.length - 1]; va.ui.placing = null; return va.doc().comps.length === n + 1 && Math.abs(c.x - 300) <= 10 && Math.abs(c.y - 300) <= 10; }, place.n)]);
await pm.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('diagram'); va.startSim(); const s1 = va.doc().comps.find(c => c.tag === 'S1'); va.sim.pressed.add(s1.id); va.solve(); va.sim.pressed.clear(); va.solve(); });
const g2 = await geo();
await pm.click('#bInsp'); await pm.waitForTimeout(450);
const g3 = await geo();
results.push(['Painel: segundo clique fecha e a área de trabalho volta a crescer', !g3.open && g3.pmW < 1 && g3.w > g2.w + 250 && g3.z === g2.z && g3.px === g2.px]);
results.push(['Painel: abrir e fechar não interrompe a simulação', await pm.evaluate(() => window.__va.sim.running && window.__va.sim.coils.K1)]);
await pm.click('#bInsp'); await pm.waitForTimeout(400); await pm.keyboard.press('Escape'); await pm.waitForTimeout(400);
results.push(['Painel: Escape fecha', await pm.evaluate(() => !window.__va.ui.inspOpen && document.getElementById('pm').getBoundingClientRect().width < 1)]);
await pm.click('#bInsp'); await pm.waitForTimeout(400); await pm.click('#pmClose'); await pm.waitForTimeout(400);
results.push(['Painel: botão X fecha', await pm.evaluate(() => !window.__va.ui.inspOpen)]);
await pm.evaluate(() => window.__va.stopSim());
results.push(['Painel e modo foco independentes: status visível, navegação recolhe', await pm.evaluate(() => !window.__va.focus.navigationExpanded && document.getElementById('status').getBoundingClientRect().height > 20)]);
await pm.close();

// ---- Interactive HMI & Practical Exercise Engine ----
const hx = await browser.newPage({ viewport: { width: 1440, height: 900 } });
hx.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await hx.goto(page); await hx.waitForTimeout(400);
await hx.evaluate(() => { try { Object.keys(localStorage).filter(k => k.startsWith('voltacademy.ex')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
results.push(...await hx.evaluate(() => {
  const va = window.__va, out = [], chk = (n, c) => out.push([n, !!c]), get = id => va.ApplicationRegistry.get(id), apps = va.ApplicationRegistry.list;
  chk('Aplicações: 11 cadastradas nas 7 famílias iniciais', apps.length === 11 && new Set(apps.map(a => a.family)).size === 7);
  chk('Aplicações: configuração centralizada completa (dispositivos, exemplo, requisitos, testes, demonstração, rede)', apps.every(a => a.applicationId && a.sceneTemplate && a.devices.length && a.exampleProjectReference && a.exerciseRequirements.length && a.testScenarios.length && a.demonstrationSequence.script.length && a.electricalConfig && a.criteria.length));
  for (const app of apps) { va.load(app.exampleProjectReference()); const r = va.ExerciseValidationEngine.runAllSync(app); chk(`Exemplo resolvido aprovado em todos os testes: ${app.title}`, Object.values(r).every(x => x.status === 'ok')); }
  chk('Exercícios em branco: nenhum teste aprovado', apps.every(app => { va.load(va.ExerciseSession.create(app)); return Object.values(va.ExerciseValidationEngine.runAllSync(app)).every(x => x.status !== 'ok'); }));
  const mut = (id, f) => { const app = get(id), d = app.exampleProjectReference(); f(d); va.load(d); return va.ExerciseValidationEngine.runAllSync(app); };
  const bridge = (d, pred) => { for (const c of d.comps.filter(pred)) { c.type = 'contato_nf'; c.tag = 'KX'; delete c.dev; } };
  const spare = (d, type, tag) => d.comps.push({ id: 'cx' + tag, type, x: 1300, y: 300, rot: 0, tag, sheet: d.sheets[d.sheets.length - 1].id });
  let r = mut('caixa_dagua', d => { bridge(d, c => c.tag === 'B2'); spare(d, 'boia_nf', 'B2'); });
  chk('Feedback: caixa d’água sem B2 → "não desligou após atingir o nível máximo"', r.W2.status === 'fail' && /não desligou após atingir o nível máximo/.test(r.W2.msg) && r.W1.status === 'ok');
  r = mut('estrela_triangulo', d => { const k2 = d.comps.find(c => c.type === 'bobina' && c.tag === 'K2'); const k3 = d.comps.find(c => c.type === 'bobina' && c.tag === 'K3'); bridge(d, c => (c.x === k2.x && (c.type === 'temp_nf' || (c.type === 'contato_nf' && c.tag === 'K3'))) || (c.x === k3.x && c.type === 'contato_nf' && c.tag === 'K2')); });
  chk('Feedback: estrela-triângulo sem intertravamento → conflito estrela/triângulo', r.SD3.status === 'fail' && /estrela permaneceu energizado/.test(r.SD3.msg));
  r = mut('portao', d => { bridge(d, c => c.tag === 'FC1'); spare(d, 'fim_curso_nf', 'FC1'); });
  chk('Feedback: portão sem FC1 → comando de abertura após o fim de curso', r.G1.status === 'fail' && /após atingir o fim de curso/.test(r.G1.msg));
  r = mut('emergencia', d => bridge(d, c => c.type === 'contato_na' && c.tag === 'KA1'));
  chk('Feedback: emergência que não bloqueia K1 → reprovado na interrupção', r.E2.status === 'fail' && /continuou funcionando com a emergência/.test(r.E2.msg));
  r = mut('flip_flop', d => { const ka1 = d.comps.find(c => c.type === 'bobina' && c.tag === 'KA1'); bridge(d, c => c.type === 'contato_nf' && c.tag === 'KA2' && c.x <= ka1.x + 120 && c.x >= ka1.x); });
  chk('Feedback: flip-flop sem bloqueio → segundo pulso não desliga', r.F2.status === 'fail');
  // demonstration never touches the project nor the simulation
  const wa = get('caixa_dagua'); va.load(wa.exampleProjectReference()); const before = va.serialize(); va.DemoRunner.start(wa);
  let ran = false; const l0 = va.DemoRunner.s.st.lvl; for (let i = 0; i < 400; i++) { va.DemoRunner.step(.05); ran = ran || va.DemoRunner.s.out.M1.run; }
  chk('Demonstração: usa a sequência de referência sem alterar o projeto nem a simulação', ran && va.DemoRunner.s.st.lvl !== l0 && !va.sim.running && va.serialize() === before && !Object.keys(va.sim.coils).length);
  // live: actuators -> process -> sensors -> electrical engine
  va.startSim(); va.Proc.st.cons = 0; va.Proc.st.lvl = 15; for (let i = 0; i < 10; i++) va.simStep(.05);
  const b1 = va.doc().comps.find(c => c.tag === 'B1'), b2 = va.doc().comps.find(c => c.tag === 'B2');
  const pumpOn = va.VirtualActuatorEngine.read(wa).out.M1.run && va.sim.toggled.has(b1.id);
  let l1 = va.Proc.st.lvl; for (let i = 0; i < 20; i++) va.simStep(.05);
  const rising = va.Proc.st.lvl > l1;
  va.Proc.st.lvl = 84.9; for (let i = 0; i < 6; i++) va.simStep(.05);
  chk('Ao vivo: B1 do processo aciona o circuito, a bomba real enche o reservatório', pumpOn && rising);
  chk('Ao vivo: B2 enviado ao motor elétrico e o circuito do aluno desliga a bomba', va.sim.toggled.has(b2.id) && !va.VirtualActuatorEngine.read(wa).out.M1.run && !va.sim.coils.K1);
  va.stopSim();
  va.load((() => { const d = wa.exampleProjectReference(); bridge(d, c => c.tag === 'B2'); return d; })()); va.startSim(); va.Proc.st.cons = 0; va.Proc.st.lvl = 15;
  for (let i = 0; i < 300; i++) va.simStep(.05);
  chk('Ao vivo: circuito errado mostra a consequência (transbordamento), sem correção automática', va.Proc.faults.some(f => f.code === 'overflow') && va.VirtualActuatorEngine.read(wa).out.M1.run);
  va.stopSim();
  // tag binding
  va.load(va.ExerciseSession.create(wa)); const m = va.addComp('motor_3f', 300, 300); m.tag = 'M7';
  const okBind = va.TagBindingManager.bind(m, 'M1') !== false && m.tag === 'M1' && m.dev === 'M1';
  const bt = va.addComp('botao_na', 500, 300); const bad = va.TagBindingManager.bind(bt, 'M1') === false; bt.tag = 'M1';
  chk('TAGs: vínculo por identificador estável e validação de tipo (M1 não aceita botoeira)', okBind && bad && va.TagBindingManager.issues().some(s => /M1/.test(s)) && va.TagBindingManager.devOf(m).id === 'M1');
  const s1a = va.addComp('botao_na', 300, 500), s1b = va.addComp('botao_na', 400, 500); va.TagBindingManager.bind(s1a, 'S1'); va.TagBindingManager.bind(s1b, 'S1');
  chk('TAGs: vários componentes associados ao mesmo dispositivo', va.TagBindingManager.comps(va.TagBindingManager.device(wa, 'S1')).length === 2);
  va.doc().app.results = { W1: { status: 'ok', msg: 'x' } }; const js = va.serialize(); va.load(js);
  chk('Persistência: sessão do exercício, resultados e rede salvos no arquivo', va.doc().app.mode === 'exercise' && va.doc().app.results.W1.status === 'ok' && va.doc().elec.v === 380 && JSON.parse(js).app.id === 'caixa_dagua');
  va.load(va.EXAMPLES[0].build());
  chk('Projetos livres e exemplos antigos continuam sem aplicação associada', !va.doc().app);
  return out;
}));
// UI flow: VOLT CORE → Exercícios → Practical Exercise Lab → Iniciar exercício → validar
await hx.evaluate(() => { window.__va.setView('home'); window.__va.homeSelect(4); }); await hx.waitForTimeout(900);
await hx.evaluate(() => window.__va.homeConfirm()); await hx.waitForTimeout(900);
const lab1 = await hx.evaluate(() => document.getElementById('exScene').innerHTML);
await hx.waitForTimeout(700);
results.push(['Exercise Lab: 5ª opção do carrossel abre a lista com demonstração animada', await hx.evaluate(s0 => { const va = window.__va; return va.ui.view === 'exlab' && document.querySelectorAll('#exList .ex-item').length === 11 && /DEMONSTRATION MODE/.test(document.getElementById('exMode').textContent) && /MODO DEMONSTRAÇÃO/.test(document.getElementById('exScene').textContent) && va.DemoRunner.s.t > .8 && !!document.querySelector('#exScene svg'); }, lab1)]);
results.push(['Exercise Lab: requisitos, TAGs e critérios sem diagrama resolvido', await hx.evaluate(() => { const t = document.getElementById('exInfo'); return /Requisitos de funcionamento/i.test(t.textContent) && t.querySelectorAll('.ex-tags tr').length > 3 && !document.querySelector('#vExLab .thumb, #vExLab #world'); })]);
await hx.click('#exList [data-ex="9"]'); await hx.waitForTimeout(200);
await hx.click('#exStart'); await hx.waitForTimeout(700);
results.push(['Iniciar exercício: nova instância com folhas em branco, rede e TAGs', await hx.evaluate(() => { const va = window.__va, d = va.doc(); return va.ui.view === 'diagram' && d.app.mode === 'exercise' && d.app.id === 'caixa_dagua' && d.comps.length === 0 && d.wires.length === 0 && d.sheets.map(s => s.name).join() === 'Força,Comando' && d.elec.v === 380 && !document.getElementById('pmTabApp').hidden && va.ui.pmTab === 'app'; })]);
await hx.click('#exValidate'); await hx.waitForTimeout(1500);
results.push(['Validar exercício: resultados por teste e progresso salvo (sem aprovação fictícia)', await hx.evaluate(() => { const va = window.__va, res = va.doc().app.results, idx = JSON.parse(localStorage.getItem('voltacademy.ex.index') || '{}'); return Object.keys(res).length === 6 && Object.values(res).every(r => r.status === 'inc' || r.status === 'fail') && idx.caixa_dagua && idx.caixa_dagua.pct === 0 && /Inconclusivo/.test(document.getElementById('pmApp').textContent); })]);
await hx.click('#pmApp [data-hint]'); await hx.waitForTimeout(150);
results.push(['Feedback: dicas progressivas por requisito', await hx.evaluate(() => /Dica 1:/.test(document.getElementById('pmApp').textContent) && window.__va.doc().app.hints.R1 === 1)]);
await hx.evaluate(() => { const va = window.__va; va.setView('home'); va.setView('exlab'); va.EX.sel = 9; va.render(); }); await hx.waitForTimeout(300);
results.push(['Continuar exercício: progresso disponível na biblioteca', await hx.evaluate(() => !!document.getElementById('exResume') && !!document.querySelector('#exList .ex-item.act .ex-prog'))]);
await hx.click('#exResume'); await hx.waitForTimeout(500);
results.push(['Continuar exercício: retoma a mesma sessão', await hx.evaluate(() => { const d = window.__va.doc(); return d.app.mode === 'exercise' && d.app.hints.R1 === 1 && Object.keys(d.app.results).length === 6; })]);
// Operation / HMI with a solved example
await hx.evaluate(() => { const va = window.__va; va.load(va.ApplicationRegistry.get('caixa_dagua').exampleProjectReference()); va.setView('operate'); });
await hx.waitForTimeout(200);
results.push(['Operação / HMI: aplicação carregada automaticamente e modo identificado', await hx.evaluate(() => /Operação \/ HMI/.test(document.querySelector('[data-nav="operate"]').textContent) && !!document.querySelector('#hmiStage svg') && /SIMULAÇÃO PARADA/.test(document.getElementById('hmiStage').textContent) && document.querySelectorAll('#vOperate [data-hdev]').length === 2 && !!document.querySelector('#hmiSens'))]);
await hx.click('#bRun'); await hx.waitForTimeout(300);
await hx.evaluate(() => { const va = window.__va; va.Proc.st.lvl = 50; va.Proc.st.cons = 0; });
const s1 = await hx.locator('#vOperate [data-hdev="S1"]').boundingBox();
await hx.mouse.move(s1.x + s1.width / 2, s1.y + s1.height / 2); await hx.mouse.down(); await hx.waitForTimeout(250); await hx.mouse.up(); await hx.waitForTimeout(600);
results.push(['Operação / HMI: botoeira S1 da IHM opera o circuito e a bomba gira ao vivo', await hx.evaluate(() => { const va = window.__va; return /SIMULAÇÃO AO VIVO/.test(document.getElementById('hmiStage').textContent) && va.VirtualActuatorEngine.read(va.ApplicationRegistry.get('caixa_dagua')).out.M1.run && /girando/.test(document.getElementById('hmiOut').textContent); })]);
await hx.evaluate(() => window.__va.stopSim());
await hx.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('operate'); }); await hx.waitForTimeout(150);
results.push(['Operação / HMI: sem aplicação preserva o painel genérico', await hx.evaluate(() => !!document.querySelector('#vOperate .opgrid') && !document.getElementById('hmiStage'))]);
await hx.evaluate(() => { const va = window.__va; va.ExerciseSession.start(va.ApplicationRegistry.get('portao')); const c = va.addComp('motor_3f', 400, 400); va.ui.sel = { kind: 'comp', id: c.id }; va.ui.inspOpen = true; va.render(); });
await hx.waitForTimeout(200);
results.push(['Inspetor: associar componente a um dispositivo do exercício', await hx.evaluate(() => { const s = document.getElementById('fDev'); return !!s && [...s.options].some(o => o.value === 'M1') && ![...s.options].some(o => o.value === 'S1'); })]);
await hx.evaluate(() => { const va = window.__va; va.setView('lab'); va.labSelect(va.EXAMPLES.findIndex(e => e.app === 'semaforo')); }); await hx.waitForTimeout(300);
results.push(['Project Lab: exemplos novos com categoria, nível, template de IHM e TAGs', await hx.evaluate(() => /Template de IHM/.test(document.getElementById('labInfo').textContent) && /Intermediário/.test(document.getElementById('labInfo').textContent) && /KT1/.test(document.getElementById('labInfo').textContent))]);
await hx.close();

// ---- Fase 1: seleção múltipla ----
const sl = await browser.newPage({ viewport: { width: 1440, height: 900 } });
sl.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await sl.goto(page); await sl.waitForTimeout(400);
await sl.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('diagram'); document.getElementById('bFit').click(); });
await sl.waitForTimeout(300);
const scr = (tag, type) => sl.evaluate(([t, ty]) => { const va = window.__va, c = va.doc().comps.find(x => x.tag === t && (!ty || x.type === ty) && x.sheet === va.ui.sheet), r = document.getElementById('cv').getBoundingClientRect(); return [r.left + va.ui.px + c.x * va.ui.zoom, r.top + va.ui.py + c.y * va.ui.zoom]; }, [tag, type]);
const clickAt = async ([x, y], mod) => { if (mod) await sl.keyboard.down(mod); await sl.mouse.click(x, y); if (mod) await sl.keyboard.up(mod); await sl.waitForTimeout(80); };
await clickAt(await scr('S0'));
results.push(['Seleção: clique seleciona um componente (Propriedades só com duplo clique)', await sl.evaluate(() => { const va = window.__va; return va.ui.sel && va.doc().comps.find(c => c.id === va.ui.sel.id).tag === 'S0' && !va.ui.inspOpen; })]);
await clickAt(await scr('Q1'), 'Control'); await clickAt(await scr('H2'), 'Control'); await clickAt(await scr('FT1'), 'Shift');
results.push(['Seleção: Ctrl/Shift + clique combinam categorias diferentes', await sl.evaluate(() => { const va = window.__va, tags = [...va.ui.multi].map(id => va.doc().comps.find(c => c.id === id)); return va.ui.multi.size === 4 && new Set(tags.map(c => va.TYPES[c.type].cat)).size >= 3 && document.querySelectorAll('#cv .comp.msel').length === 4; })]);
await clickAt(await scr('H2'), 'Control');
results.push(['Seleção: Ctrl + clique remove da seleção', await sl.evaluate(() => window.__va.ui.multi.size === 3)]);
await sl.keyboard.press('Escape'); await sl.waitForTimeout(80);
results.push(['Seleção: Esc limpa a seleção', await sl.evaluate(() => window.__va.ui.multi.size === 0 && !window.__va.ui.sel)]);
await sl.keyboard.press('Control+a'); await sl.waitForTimeout(80);
results.push(['Seleção: Ctrl+A seleciona todos da folha ativa', await sl.evaluate(() => { const va = window.__va; return va.ui.multi.size === va.doc().comps.filter(c => c.sheet === va.ui.sheet).length; })]);
await sl.keyboard.press('Escape');
// marquee left -> right (window) around S0 and S1 only
const [s0x, s0y] = await scr('S0'), [s1x, s1y] = await scr('S1'), z = await sl.evaluate(() => window.__va.ui.zoom), px0 = await sl.evaluate(() => [window.__va.ui.px, window.__va.ui.py]);
await sl.mouse.move(s0x - 60 * z, s0y - 70 * z); await sl.mouse.down(); await sl.mouse.move(s1x + 40 * z, s1y + 60 * z, { steps: 6 }); await sl.mouse.up(); await sl.waitForTimeout(80);
results.push(['Seleção por janela (esquerda → direita): só os totalmente contidos', await sl.evaluate(() => { const va = window.__va, tags = [...va.ui.multi].map(id => va.doc().comps.find(c => c.id === id).tag).sort(); return tags.join() === 'S0,S1'; })]);
results.push(['Seleção por janela não move a folha nem cria fios', await sl.evaluate(p0 => { const va = window.__va; return va.ui.px === p0[0] && va.ui.py === p0[1] && va.doc().wires.length === 14 && !va.ui.wireStart; }, px0)]);
await sl.keyboard.press('Escape');
await sl.mouse.move(s1x + 62 * z, s1y + 52 * z); await sl.mouse.down(); await sl.mouse.move(s0x - 2 * z, s0y - 2 * z, { steps: 6 }); await sl.mouse.up(); await sl.waitForTimeout(80);
results.push(['Seleção cruzada (direita → esquerda): os que interceptam', await sl.evaluate(() => { const va = window.__va, tags = [...va.ui.multi].map(id => va.doc().comps.find(c => c.id === id).tag); return tags.includes('S0') && tags.includes('S1'); })]);
// group move
await sl.keyboard.press('Escape');
await clickAt(await scr('S1')); await clickAt(await scr('K1'), 'Control');
const gBefore = await sl.evaluate(() => { const va = window.__va, d = va.doc(); return { pos: d.comps.map(c => [c.id, c.x, c.y]), wires: JSON.stringify(d.wires.map(w => [w.id, w.a, w.b])) }; });
const [k1x, k1y] = await scr('S1');
await sl.mouse.move(k1x, k1y); await sl.mouse.down(); await sl.mouse.move(k1x + 120 * z, k1y + 40 * z, { steps: 8 }); await sl.mouse.up(); await sl.waitForTimeout(100);
results.push(['Movimento em grupo: distâncias, conexões e demais componentes preservados', await sl.evaluate(b => { const va = window.__va, d = va.doc(), sel = va.ui.multi; const moved = d.comps.filter(c => sel.has(c.id)).map(c => { const o = b.pos.find(x => x[0] === c.id); return [c.x - o[1], c.y - o[2]]; }); const still = d.comps.filter(c => !sel.has(c.id)).every(c => { const o = b.pos.find(x => x[0] === c.id); return c.x === o[1] && c.y === o[2]; }); return sel.size === 2 && moved.every(m => m[0] === moved[0][0] && m[1] === moved[0][1]) && moved[0][0] > 0 && still && JSON.stringify(d.wires.map(w => [w.id, w.a, w.b])) === b.wires; }, gBefore)]);
await sl.keyboard.press('Control+z'); await sl.waitForTimeout(80);
// copy / paste
await sl.keyboard.press('Escape'); await clickAt(await scr('S1')); await clickAt(await scr('K1', 'bobina'), 'Control');
await sl.keyboard.press('Control+c'); await sl.keyboard.press('Control+v'); await sl.waitForTimeout(100);
results.push(['Copiar e colar grupo: novas TAGs para dispositivos e fios internos copiados', await sl.evaluate(() => { const va = window.__va, d = va.doc(), news = [...va.ui.multi].map(id => d.comps.find(c => c.id === id)); return d.comps.length === 14 && news.length === 2 && news.some(c => c.type === 'bobina' && c.tag === 'K2') && news.some(c => c.type === 'botao_na' && c.tag !== 'S1'); })]);
await sl.keyboard.press('Delete'); await sl.waitForTimeout(80);
results.push(['Exclusão em grupo remove só os selecionados', await sl.evaluate(() => window.__va.doc().comps.length === 12 && window.__va.ui.multi.size === 0)]);
await sl.keyboard.press('Control+a'); await sl.keyboard.press('Delete'); await sl.waitForTimeout(100);
results.push(['Exclusão de muitos componentes pede confirmação', await sl.evaluate(() => !document.getElementById('modal').hidden && /Excluir 12 componentes/.test(document.getElementById('sheet').textContent) && window.__va.doc().comps.length === 12)]);
await sl.click('#dConfirm'); await sl.waitForTimeout(80);
results.push(['Exclusão confirmada remove os componentes e seus fios', await sl.evaluate(() => window.__va.doc().comps.filter(c => c.sheet === window.__va.ui.sheet).length === 0 && window.__va.doc().wires.length === 0)]);
await sl.keyboard.press('Control+z'); await sl.waitForTimeout(80);
results.push(['Desfazer restaura a exclusão em grupo', await sl.evaluate(() => window.__va.doc().comps.length === 12 && window.__va.doc().wires.length === 14)]);
await sl.close();

// ---- Fases 2 e 3: folhas na barra externa e barra superior contextual ----
const sn = await browser.newPage({ viewport: { width: 1440, height: 900 } });
sn.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await sn.goto(page); await sn.waitForTimeout(400);
await sn.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); va.setView('diagram'); });
await sn.waitForTimeout(200);
results.push(['Folhas: barra externa mostra todas as folhas com número, nome e conteúdo (painel fechado)', await sn.evaluate(() => { const va = window.__va, tabs = [...document.querySelectorAll('#sheetNav .stab')]; return !va.ui.inspOpen && tabs.length === va.doc().sheets.length && /01\.Força/.test(tabs[0].textContent) && tabs[0].querySelector('.stc').textContent === String(va.doc().comps.filter(c => c.sheet === va.doc().sheets[0].id).length) && tabs[0].classList.contains('act'); })]);
await sn.click('#sheetNav .stab:nth-child(2)'); await sn.waitForTimeout(150);
results.push(['Folhas: clicar na aba carrega o diagrama da folha', await sn.evaluate(() => { const va = window.__va; return va.ui.sheet === va.doc().sheets[1].id && document.querySelector('#sheetNav .stab.act').dataset.sheet === va.ui.sheet && document.querySelectorAll('#world [data-comp]').length === va.doc().comps.filter(c => c.sheet === va.ui.sheet).length; })]);
await sn.evaluate(() => { const va = window.__va; va.ui.inspOpen = true; va.ui.pmTab = 'proj'; va.render(); }); await sn.waitForTimeout(400);
await sn.click('#sNew'); await sn.fill('#dName', 'Sinalização'); await sn.click('#dSave'); await sn.waitForTimeout(150);
results.push(['Folhas: nova folha criada no Painel aparece na barra externa', await sn.evaluate(() => { const tabs = [...document.querySelectorAll('#sheetNav .stab')]; return tabs.length === 3 && /03\.Sinalização/.test(document.querySelector('#sheetNav .stab.act').textContent); })]);
await sn.click('#sRen'); await sn.fill('#dName', 'Controle'); await sn.click('#dSave'); await sn.waitForTimeout(150);
results.push(['Folhas: renomear atualiza a barra externa', await sn.evaluate(() => /Controle/.test(document.querySelector('#sheetNav .stab.act').textContent))]);
await sn.click('#sDel'); await sn.click('#dConfirm'); await sn.waitForTimeout(150);
results.push(['Folhas: excluir atualiza a navegação', await sn.evaluate(() => document.querySelectorAll('#sheetNav .stab').length === 2)]);
await sn.click('#sheetNav .stab:nth-child(2)'); await sn.click('#sDup'); await sn.waitForTimeout(150);
results.push(['Folhas: duplicar folha copia componentes e fios com novas TAGs de dispositivos', await sn.evaluate(() => { const va = window.__va, d = va.doc(), a = d.sheets[1], b = d.sheets[2]; const ca = d.comps.filter(c => c.sheet === a.id), cb = d.comps.filter(c => c.sheet === b.id), ib = new Set(cb.map(c => c.id)); return d.sheets.length === 3 && /cópia/.test(b.name) && cb.length === ca.length && d.wires.filter(w => ib.has(w.a.c)).length > 0 && cb.some(c => c.type === 'bobina' && c.tag !== 'K1') && va.ui.sheet === b.id; })]);
await sn.evaluate(() => { const va = window.__va; va.load({ project: 'uma', comps: [], wires: [] }); va.setView('diagram'); va.ui.inspOpen = true; va.ui.pmTab = 'proj'; va.render(); }); await sn.waitForTimeout(300);
await sn.click('#sDel'); await sn.waitForTimeout(150);
results.push(['Folhas: não permite excluir a última folha', await sn.evaluate(() => window.__va.doc().sheets.length === 1)]);
await sn.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.doc().comps.push({ id: 'cx1', type: 'botao_na', x: 900, y: 300, rot: 0, tag: 'S9', sheet: va.doc().sheets[0].id }); va.setView('diagram'); va.render(); });
results.push(['Folhas: indicador de avisos na aba', await sn.evaluate(() => !!document.querySelector('#sheetNav .stab.act .stw'))]);
const vis = view => sn.evaluate(v => { const va = window.__va; va.setView(v); return ['#bRun', '#clock', '#bUndo', '#bRedo', '#bFile', '#bHelp', '#bSound', '#bTheme', '#bInsp'].filter(s => !document.querySelector(s).hidden).join(' '); }, view);
const tb = { diagram: await vis('diagram'), operate: await vis('operate'), home: await vis('home'), tags: await vis('tags'), monitor: await vis('monitor') };
results.push(['Barra superior: Diagrama com as ferramentas completas', tb.diagram === '#bRun #clock #bUndo #bRedo #bFile #bHelp #bSound #bTheme #bInsp']);
results.push(['Barra superior: Operação / HMI só Simular, Ajuda e Tema', tb.operate === '#bRun #bHelp #bTheme']);
results.push(['Barra superior: Início e Listas com Projeto, Ajuda, Som e Tema', tb.home === '#bFile #bHelp #bSound #bTheme' && tb.tags === tb.home]);
results.push(['Barra superior: Monitoramento com Simular, Projeto, Ajuda, Som e Tema', tb.monitor === '#bRun #clock #bFile #bHelp #bSound #bTheme']);
results.push(['Barra superior: ferramentas centralizadas na tela em todas as visões', await sn.evaluate(() => ['home', 'operate', 'diagram'].every(v => { window.__va.setView(v); const a = document.getElementById('topActs').getBoundingClientRect(); return Math.abs((a.left + a.right) / 2 - innerWidth / 2) < 3; }))]);
await sn.close();

// ---- Fases 5 a 10: IHM com entradas/saídas, sensores, sons, falhas, semáforo e monitoramento ----
const io = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
io.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await io.goto(page); await io.waitForTimeout(400);
await io.evaluate(() => { const va = window.__va; va.load(va.ApplicationRegistry.get('semaforo').exampleProjectReference()); va.setView('operate'); });
await io.waitForTimeout(150);
results.push(['IHM: entradas com representação do dispositivo (Liga, Desliga, Emergência, Seletora)', await io.evaluate(() => { const k = [...document.querySelectorAll('#hmiIn [data-hdev]')].map(b => b.dataset.hdev + ':' + b.dataset.kind).join(); return k === 'S1:push,S0:push,SE1:emergency,SA1:selector' && document.querySelectorAll('#hmiIn svg').length === 4 && !document.getElementById('opRun'); })]);
await io.click('#bRun'); await io.waitForTimeout(200);
await io.click('#hmiIn [data-hdev="SA1"]'); await io.waitForTimeout(100);
const bS1 = await io.locator('#hmiIn [data-hdev="S1"]').boundingBox();
await io.mouse.move(bS1.x + bS1.width / 2, bS1.y + 30); await io.mouse.down(); await io.waitForTimeout(200); await io.mouse.up(); await io.waitForTimeout(300);
results.push(['IHM → motor elétrico: S1 e SA1 pela IHM ligam K1 e o verde no circuito', await io.evaluate(() => { const va = window.__va; return va.sim.coils.K1 && va.sim.timerOn.KT1 && va.VirtualActuatorEngine.read(va.ApplicationRegistry.get('semaforo')).out.H3 && /Automático/.test(document.querySelector('#hmiIn [data-hdev="SA1"]').textContent) && /VERDE/.test(document.getElementById('hmiStage').textContent); })]);
results.push(['Monitoramento coerente: entradas, saídas, temporizadores e histórico com tempo de simulação', await io.evaluate(() => { const va = window.__va; va.setView('monitor'); const t = document.getElementById('moIO').textContent, ev = document.getElementById('moEvents').textContent; const ok = /Entradas digitais/.test(t) && /SA1/.test(t) && /1 · acionada/.test(t) && /Saídas digitais/.test(t) && /H3/.test(t) && /Temporizadores/.test(t) && /Entrada S1: acionada/.test(ev) && /Contator K1: energizado/.test(ev) && /00:0\d\.\d/.test(ev); va.setView('operate'); return ok; })]);
// sounds only on real transitions
results.push(...await io.evaluate(() => {
  const va = window.__va, out = [], log = [], orig = va.Sfx.play; va.Sfx.play = n => log.push([va.sim.t, n]);
  va.stopSim(); va.startSim(); va.SfxWatch.reset();
  const step = n => { for (let i = 0; i < n; i++) { va.simStep(.05); va.SfxWatch.update(); } };
  step(1); va.HMIBindingEngine.toggle('SA1', true); va.HMIBindingEngine.press('S1', true); step(2); va.HMIBindingEngine.press('S1', false);
  step(40); const n1 = log.length; step(30); const steady = log.filter(([t]) => t > 2.3 && t < 3.6).length;
  step(60);
  const ticks = log.filter(([, n]) => n === 'tick').length, relays = log.filter(([, n]) => n === 'relay').length;
  out.push(['Sons: comutação do semáforo só quando a cor muda de verdade', ticks >= 2 && steady === 0]);
  out.push(['Sons: acionamento de relé/contator sem repetir enquanto permanece ligado', relays >= 1 && relays < 20 && log.filter(([t, n]) => n === 'relay' && t > 2.3 && t < 3.6).length === 0]);
  va.Sfx.play = orig; va.Sfx.on = false; const off = va.Sfx.level() === 0; va.Sfx.on = true; va.ui.mute = true; const mute = va.Sfx.level() === 0; va.ui.mute = false;
  out.push(['Sons: podem ser desativados (efeitos e botão Som)', off && mute]);
  return out;
}));
// test mode + fault injection (run on the real circuit)
results.push(...await io.evaluate(() => {
  const va = window.__va, app = va.ApplicationRegistry.get('semaforo'), out = [], run = (id, secs) => { va.LiveScript.start(app, app.testMode.find(m => m.id === id)); for (let i = 0; i < secs / .05; i++) va.simStep(.05); return va.Proc.faults.map(f => f.code); };
  let f = run('normal', 12); out.push(['Modo de teste: funcionamento normal sem alarmes e com tempos medidos', !f.length && va.Proc.st.cycles >= 0 && Math.abs(va.Proc.st.durs.G + .05 - 4) < .3 && Math.abs(va.Proc.st.durs.Y + .05 - 2) < .3]);
  f = run('parada', 9); out.push(['Modo de teste: parada por S0 apaga o semáforo', !va.sim.coils.K1 && !['H1', 'H2', 'H3'].some(k => va.VirtualActuatorEngine.read(app).out[k])]);
  f = run('conflito', 6); out.push(['Modo de teste: contato colado gera sinalização conflitante detectada', f.includes('conflict') && va.sim.welded.size === 1]);
  f = run('falha_seq', 16); out.push(['Modo de teste: falha de sequência detectada pela análise do processo', f.includes('sequence') && va.Proc.faults.find(x => x.code === 'sequence').msg.includes('vermelho → amarelo')]);
  f = run('lampada', 2); out.push(['Modo de teste: lâmpada queimada = comandada mas apagada (falha de sinalização)', f.includes('lampfail:H3') && va.VirtualActuatorEngine.read(app).out.H3 && /H3 queimada/.test(va.sceneSVG(va.hmiView(app).view, 'live'))]);
  f = run('manual', 3); out.push(['Modo de teste: manual com amarelo intermitente', !f.length && va.Proc.hist.slice(-50).some(h => h.v === 2) && va.Proc.hist.slice(-50).some(h => h.v === 0)]);
  va.stopSim(); return out;
}));
// sensors: automatic, forced, failed — always sent to the electrical engine, never driving outputs directly
results.push(...await io.evaluate(() => {
  const va = window.__va, app = va.ApplicationRegistry.get('caixa_dagua'), out = [];
  va.load(app.exampleProjectReference()); va.setView('operate'); va.startSim(); va.Proc.st.cons = 0; va.Proc.st.lvl = 50;
  const b2 = va.doc().comps.find(c => c.tag === 'B2'), b1 = va.doc().comps.find(c => c.tag === 'B1');
  va.HMIBindingEngine.press('S1', true); va.simStep(.05); va.HMIBindingEngine.press('S1', false); for (let i = 0; i < 4; i++) va.simStep(.05);
  const ran = va.VirtualActuatorEngine.read(app).out.M1.run;
  va.HMIBindingEngine.forceSensor('B2', '1'); va.simStep(.05);
  out.push(['Sensores: forçar B2 em 1 é enviado ao circuito, que decide desligar a bomba', ran && va.sim.toggled.has(b2.id) && !va.VirtualActuatorEngine.read(app).out.M1.run && va.Proc.st.lvl < 60]);
  va.updateHMI();
  out.push(['Sensores: forçamento identificado (IHM, cena e monitoramento)', /FORÇADO 1/.test(document.getElementById('hmiSens').textContent) && /B2 F/.test(document.getElementById('hmiStage').textContent) && /SENSOR FORÇADO/.test(document.getElementById('hmiDiag').textContent) && /B2/.test(va.monitorIOHTML().split('Sensores forçados')[1])]);
  va.HMIBindingEngine.forceSensor('B2', 'auto'); va.simStep(.05);
  out.push(['Sensores: voltar ao automático usa o estado físico', !va.sim.toggled.has(b2.id) && !('B2' in va.Proc.st.force)]);
  va.Proc.st.lvl = 10; va.HMIBindingEngine.forceSensor('B1', 'fail'); for (let i = 0; i < 6; i++) va.simStep(.05);
  out.push(['Sensores: falha de sensor envia 0 e a bomba não parte sozinha', !va.sim.toggled.has(b1.id) && !va.VirtualActuatorEngine.read(app).out.M1.run && /SENSOR EM FALHA/.test(va.hmiDiagHTML(app))]);
  va.HMIBindingEngine.clearInjected(); for (let i = 0; i < 6; i++) va.simStep(.05);
  out.push(['Sensores: remover falhas devolve o controle ao processo físico', va.VirtualActuatorEngine.read(app).out.M1.run]);
  va.stopSim();
  // exercise without circuit: HMI inputs reach the engine, nothing lights by itself
  va.load(va.ExerciseSession.create(va.ApplicationRegistry.get('semaforo'))); va.startSim(); va.HMIBindingEngine.toggle('SA1', true); va.HMIBindingEngine.press('S1', true); for (let i = 0; i < 10; i++) va.simStep(.05);
  const o = va.VirtualActuatorEngine.read(va.ApplicationRegistry.get('semaforo')).out;
  out.push(['IHM não aciona saídas sem o circuito: sem diagrama, nada acende', !o.H1 && !o.H2 && !o.H3 && !o.K1]);
  va.stopSim();
  return out;
}));
// electrical failures shown from the engine: short + protection, gate motor failure, water overflow
results.push(...await io.evaluate(() => {
  const va = window.__va, out = [], sd = va.ApplicationRegistry.get('estrela_triangulo'), d = sd.exampleProjectReference();
  const k2 = d.comps.find(c => c.type === 'bobina' && c.tag === 'K2'), k3 = d.comps.find(c => c.type === 'bobina' && c.tag === 'K3');
  for (const c of d.comps) if ((c.x === k2.x && (c.type === 'temp_nf' || (c.type === 'contato_nf' && c.tag === 'K3'))) || (c.x === k3.x && c.type === 'contato_nf' && c.tag === 'K2')) { c.type = 'contato_nf'; c.tag = 'KX'; delete c.dev; }
  va.load(d); va.setView('operate'); va.startSim(); va.HMIBindingEngine.press('S1', true); va.simStep(.05); va.HMIBindingEngine.press('S1', false);
  for (let i = 0; i < 80; i++) va.simStep(.05);
  const al = va.elecAlerts().map(a => a.k); const svg = va.sceneSVG(va.hmiView(sd).view, 'live');
  out.push(['Falhas elétricas: curto detectado pelo motor, proteção atuada e animação educacional', al.includes('prot') && !!va.sim.spike && va.Proc.faults.some(f => f.code === 'conflict') && /Proteção atuada/.test(svg) && /Q1/.test(va.hmiDiagHTML(sd))]);
  va.stopSim();
  const gt = va.ApplicationRegistry.get('portao'); va.load(gt.exampleProjectReference()); va.startSim(); va.HMIBindingEngine.control(gt.controls.find(c => c.id === 'mf'));
  va.HMIBindingEngine.press('S1', true); va.simStep(.05); va.HMIBindingEngine.press('S1', false); for (let i = 0; i < 20; i++) va.simStep(.05);
  out.push(['Falhas do portão: motor comandado sem movimento gera alarme', va.Proc.st.pos === 0 && va.Proc.faults.some(f => f.code === 'motorfail') && va.VirtualActuatorEngine.read(gt).out.M1.run]);
  va.stopSim();
  return out;
}));
await io.close();

// ---- Tela inicial JARVIS ORBITAL ----
const jh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
jh.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await jh.goto(page); await jh.waitForTimeout(1200);
results.push(['Jarvis: núcleo central renderizado (WebGL2 ou alternativa 2D)', await jh.evaluate(() => { const va = window.__va; return va.JarvisCore.ok ? document.getElementById('vHome').classList.contains('webgl') && document.getElementById('jarvisGL').width > 10 : getComputedStyle(document.getElementById('holoHome')).display !== 'none'; })]);
results.push(['Jarvis: cinco módulos em órbita na ordem da referência', await jh.evaluate(() => { const va = window.__va, mods = [...document.querySelectorAll('#jOrbit .jmod')]; return va.HOME_OPS.map(o => o.id).join() === 'abrir,continuar,novo,exemplos,exercicios' && mods.length === 5 && mods.map(m => m.querySelector('.jlabel').textContent).join('|') === 'ABRIR PROJETO|CONTINUAR PROJETO|NOVO PROJETO|EXEMPLOS|EXERCÍCIOS'; })]);
results.push(['Jarvis FX: módulos usam os ícones originais (imagens webp), sem cartão nem moldura', await jh.evaluate(() => [...document.querySelectorAll('#jOrbit .jmod')].every(m => { const cs = getComputedStyle(m), img = m.querySelector('.jobj .jimg'); return img && /^data:image\/webp/.test(img.src) && cs.borderTopWidth === '0px' && cs.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && cs.boxShadow === 'none'; }))]);
results.push(['Jarvis: módulo da frente maior, laterais intermediários, fundo menores e mais escuros', await jh.evaluate(() => { const w = i => document.querySelector(`#jOrbit [data-op="${i}"]`).getBoundingClientRect().width, f = document.querySelector('#jOrbit [data-op="2"]'); return f.classList.contains('sel') && f.classList.contains('front') && w(2) > w(1) && w(1) > w(0) && document.querySelector('#jOrbit [data-op="0"]').classList.contains('back') && +getComputedStyle(document.querySelector('#jOrbit [data-op="0"]')).getPropertyValue('--dim') < .8; })]);
results.push(['Jarvis: seleção ativa amarela, demais em azul', await jh.evaluate(() => { const c = el => getComputedStyle(el.querySelector('.jlabel')).color; return c(document.querySelector('#jOrbit .jmod.sel')) === 'rgb(255, 225, 77)' && [...document.querySelectorAll('#jOrbit .jmod:not(.sel)')].every(m => c(m) !== 'rgb(255, 225, 77)'); })]);
{ // JARVIS animation controller (section 11/12)
  const fx = () => jh.evaluate(() => { const F = window.__va.JarvisFX, s = F.state(); return { ...s, vis: document.querySelectorAll('#jHero svg.jfx').length, iconOp: +getComputedStyle(document.querySelector(`#jOrbit [data-op="${window.__va.Home.sel}"] .jobj`)).opacity, others: [...document.querySelectorAll('#jOrbit .jmod:not(.sel) .jobj')].every(o => o.style.opacity === '') }; });
  await jh.waitForTimeout(400); let s1 = await fx();
  results.push(['Jarvis FX: módulo da frente executa a sua sequência (Novo)', s1 && s1.id === 'novo' && s1.t > 0 && !s1.stopping]);
  const docBefore = await jh.evaluate(() => JSON.stringify(window.__va.doc().comps.length) + window.__va.ui.view);
  await jh.evaluate(() => { const c = window.__va.JarvisFX.cur; c.t = 7; }); await jh.waitForTimeout(400);
  results.push(['Jarvis FX: Novo destaca CRIAR PROJETO sem criar projeto', await jh.evaluate(() => document.getElementById('opGo').classList.contains('jgo-hl')) && await jh.evaluate(() => JSON.stringify(window.__va.doc().comps.length) + window.__va.ui.view) === docBefore]);
  await jh.evaluate(() => window.__va.homeSelect(3)); await jh.waitForTimeout(120);
  const mid = await fx();
  results.push(['Jarvis FX: troca encerra a anterior suavemente (fade)', mid.id === 'novo' && mid.stopping && mid.k < 1 && mid.k > 0]);
  await jh.waitForFunction(() => { const c = window.__va.JarvisFX.cur; return c && c.i === 3 && !c.stopping; }, null, { timeout: 6000 }); await jh.waitForTimeout(1000);
  const s2 = await fx();
  results.push(['Jarvis FX: nunca mais de uma sequência ativa', s2.id === 'exemplos' && s2.vis === 1]);
  results.push(['Jarvis FX: sem duplicação — o ícone orbital se dissolve enquanto a animação hero ocupa o lugar', s2.iconOp < .1 && s2.others]);
  results.push(['Jarvis FX: animação não bloqueia a interação (camadas sem pointer-events, órbita gira)', await jh.evaluate(() => getComputedStyle(document.getElementById('jHero')).pointerEvents === 'none' && !window.__va.Home.confirming)]);
  results.push(['Jarvis FX: pause e reinício', await jh.evaluate(async () => { const F = window.__va.JarvisFX; F.pause(); const a = F.state().t; await new Promise(r => setTimeout(r, 300)); const b = F.state().t; F.restart(); const c = F.state().t; F.paused = false; return a === b && c < .2; })]);
  await jh.evaluate(() => { window.__va.JarvisFX.pause(false); [0, 4, 1, 3, 2].forEach(i => window.__va.homeSelect(i)); }); await jh.waitForTimeout(2200);
  results.push(['Jarvis FX: troca rápida entre módulos não deixa resíduos', await jh.evaluate(() => { const s = window.__va.JarvisFX.state(); return s && s.id === 'novo' && document.querySelectorAll('#jHero svg').length === 1 && document.getElementById('jHero').dataset.op === 'novo' && document.querySelectorAll('#jOrbit .jmod.hero').length === 1 && [...document.querySelectorAll('#jOrbit .jmod:not(.sel) .jobj')].every(o => o.style.opacity === ''); })]);
  results.push(['Jarvis: núcleo protagonista, satélites menores e título discreto', await jh.evaluate(() => { const core = document.getElementById('jAnchor').getBoundingClientRect().height, side = document.querySelector('#jOrbit .jmod:not(.sel) .jobj').getBoundingClientRect().width, h1 = parseFloat(getComputedStyle(document.getElementById('opTitle')).fontSize); return core > side * 4 && h1 <= 24; })]);
  results.push(['Jarvis: rede neural de energia espalhada pela tela', await jh.evaluate(() => { const s = window.__va.JarvisNet.stats(); return s.nodes > 15 && s.edges > 20; })]);
}
const box = async i => { const b = await jh.locator(`#jOrbit [data-op="${i}"]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
let [x, y] = await box(3); await jh.mouse.click(x, y); await jh.waitForTimeout(1000);
results.push(['Jarvis: clicar num módulo leva-o à frente e atualiza as informações', await jh.evaluate(() => { const va = window.__va; return va.Home.sel === 3 && document.querySelector('#jOrbit [data-op="3"]').classList.contains('front') && document.getElementById('opTitle').textContent === 'Exemplos' && /15 circuitos/.test(document.getElementById('opCount').textContent) && /Abrir exemplos/i.test(document.getElementById('opGo').textContent); })]);
await jh.click('#opNext'); await jh.waitForTimeout(950);
results.push(['Jarvis: seta lateral gira para Exercícios com contagem', await jh.evaluate(() => window.__va.Home.sel === 4 && /11 exercícios/.test(document.getElementById('opCount').textContent) && /11 exercícios práticos/.test(document.getElementById('opDesc').textContent))]);
const st = await jh.locator('#jStage').boundingBox();
await jh.mouse.move(st.x + st.width * .7, st.y + st.height * .2); await jh.mouse.down(); await jh.mouse.move(st.x + st.width * .7 - 230, st.y + st.height * .2, { steps: 8 }); await jh.mouse.up(); await jh.waitForTimeout(1000);
results.push(['Jarvis: arrastar a órbita troca o módulo da frente', await jh.evaluate(() => { const H = window.__va.Home; return H.sel !== 4 && document.querySelector(`#jOrbit [data-op="${H.sel}"]`).classList.contains('front'); })]);
await jh.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); va.setView('home'); va.homeSelect(1); }); await jh.waitForTimeout(950);
[x, y] = await box(1); await jh.mouse.click(x, y); await jh.waitForTimeout(800);
results.push(['Jarvis: clicar no módulo ativo executa a função original (Continuar → Diagrama)', await jh.evaluate(() => window.__va.ui.view === 'diagram')]);
await jh.evaluate(() => { window.__va.setView('home'); window.__va.homeSelect(0); }); await jh.waitForTimeout(950);
const [fc] = await Promise.all([jh.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), jh.click('#opGo')]);
results.push(['Jarvis: Abrir projeto abre o seletor de arquivos', !!fc]);
results.push(['Jarvis: barra superior com Projeto, Ajuda, Som e Tema com ícones sólidos; Início em destaque', await jh.evaluate(() => { const vis = ['#bFile', '#bHelp', '#bSound', '#bTheme'].every(s => !document.querySelector(s).hidden && document.querySelector(s + ' .solid')) && ['#bRun', '#bUndo', '#bInsp'].every(s => document.querySelector(s).hidden); const n = document.querySelector('.nav.home'); return vis && n.classList.contains('act') && n.classList.contains('energy-active'); })]);
await jh.close();

// ---- Editor CAD: duplo clique, inserção contínua, guias inteligentes ----
{
  const ed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  ed.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await ed.goto(page); await ed.waitForTimeout(500);
  await ed.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('diagram'); va.ui.inspOpen = false; va.render(); });
  await ed.waitForTimeout(500);
  const scr = (x, y) => ed.evaluate(([x, y]) => { const va = window.__va, svg = document.getElementById('cv'), pt = svg.createSVGPoint(); pt.x = va.ui.px + x * va.ui.zoom; pt.y = va.ui.py + y * va.ui.zoom; const q = pt.matrixTransform(svg.getScreenCTM()); return [q.x, q.y]; }, [x, y]);
  const ctr = tag => ed.evaluate(t => { const c = window.__va.doc().comps.find(c => c.tag === t && c.type === 'bobina') || window.__va.doc().comps.find(c => c.tag === t); const r = document.querySelector(`[data-comp="${c.id}"] .chit`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, c.id]; }, tag);
  const st = () => ed.evaluate(() => { const va = window.__va; return { open: !!va.ui.inspOpen, tab: va.ui.pmTab, sel: va.ui.sel && va.ui.sel.id, multi: va.ui.multi.size, placing: va.ui.placing, n: va.doc().comps.length }; });
  let [kx, ky, kid] = await ctr('S1');
  await ed.mouse.click(kx, ky); await ed.waitForTimeout(150);
  let s1 = await st();
  results.push(['Editor: clique simples seleciona sem abrir Propriedades', s1.sel === kid && !s1.open && !await ed.evaluate(() => document.getElementById('pm').classList.contains('open'))]);
  await ed.waitForTimeout(400); await ed.mouse.click(kx, ky); await ed.waitForTimeout(450); await ed.mouse.click(kx, ky); await ed.waitForTimeout(150);
  results.push(['Editor: dois cliques espaçados no mesmo componente não abrem o painel', !(await st()).open]);
  await ed.waitForTimeout(400); await ed.mouse.dblclick(kx, ky); await ed.waitForTimeout(250);
  s1 = await st();
  results.push(['Editor: duplo clique verdadeiro abre Propriedades do componente clicado', s1.open && s1.tab === 'props' && s1.sel === kid && await ed.evaluate(() => document.getElementById('pm').classList.contains('open') && !document.getElementById('insp').hidden && /Botão/.test(document.querySelector('#insp .title-lg').textContent))]);
  const [sx, sy, sid] = await ctr('S0'); await ed.waitForTimeout(400); await ed.mouse.click(sx, sy); await ed.waitForTimeout(200);
  s1 = await st();
  results.push(['Editor: com o painel aberto, clique simples só atualiza o componente', s1.open && s1.tab === 'props' && s1.sel === sid]);
  await ed.evaluate(() => { const va = window.__va; va.ui.inspOpen = false; va.ui.sel = null; va.ui.multi.clear(); va.render(); });
  await ed.waitForTimeout(400); await ed.keyboard.down('Control'); await ed.mouse.click(kx, ky); await ed.mouse.click(sx, sy); await ed.keyboard.up('Control'); await ed.waitForTimeout(200);
  s1 = await st();
  results.push(['Editor: seleção múltipla com Ctrl preservada e sem abrir o painel', s1.multi === 2 && !s1.open]);
  await ed.click('#bInsp'); await ed.waitForTimeout(250);
  results.push(['Editor: botão Painel continua abrindo manualmente', (await st()).open]);
  await ed.evaluate(() => { const va = window.__va; va.ui.inspOpen = false; va.ui.multi.clear(); va.ui.sel = null; va.render(); }); await ed.waitForTimeout(300);
  // continuous insertion
  const arm = async () => { await ed.evaluate(() => { if (window.__va.ui.activeCategory !== 'Contatores e relés') document.querySelector('[data-folder="Contatores e relés"]').click(); }); await ed.waitForTimeout(350); await ed.click('#folders [data-part="bobina"]'); await ed.waitForTimeout(150); };
  await arm();
  const n0 = (await st()).n, h0 = await ed.evaluate(() => window.__va.rev());
  for (let i = 0; i < 5; i++) { const [x, y] = await scr(700 + i * 60, 760); await ed.mouse.move(x, y); await ed.mouse.click(x, y); await ed.waitForTimeout(90); }
  s1 = await st();
  const ins = await ed.evaluate(n => { const cs = window.__va.doc().comps.slice(n); return { types: cs.map(c => c.type), ids: new Set(cs.map(c => c.id)).size, tags: new Set(cs.map(c => c.tag)).size, app: cs.some(c => c.dev || c.bind) }; }, n0);
  results.push(['Inserção contínua: cinco bobinas com uma única seleção da biblioteca', s1.n === n0 + 5 && ins.types.every(t => t === 'bobina') && ins.ids === 5 && ins.tags === 5 && !ins.app && s1.placing === 'bobina']);
  results.push(['Inserção contínua: não abre Propriedades e cada inserção tem desfazer', !s1.open && await ed.evaluate(h => window.__va.rev() >= h + 5, h0) && await ed.evaluate(n => { window.__va.ui.placing = window.__va.ui.placing; document.getElementById('bUndo').click(); return window.__va.doc().comps.length === n + 4; }, n0)]);
  await ed.evaluate(() => document.getElementById('bRedo').click()); await ed.waitForTimeout(100);
  let [gx, gy] = await scr(760, 700); await ed.mouse.move(gx, gy); await ed.waitForTimeout(80);
  results.push(['Inserção contínua: prévia semitransparente acompanha o cursor', await ed.evaluate(() => { const g = document.querySelector('#cv .ghost'); return !!g && +getComputedStyle(g).opacity < 1 && getComputedStyle(g).pointerEvents === 'none'; })]);
  await ed.mouse.click(gx, gy, { button: 'right' }); await ed.waitForTimeout(150);
  s1 = await st();
  results.push(['Inserção: botão direito cancela sem inserir e volta à seleção', !s1.placing && s1.n === n0 + 5 && await ed.evaluate(() => !document.querySelector('#cv .ghost') && window.__va.ui.mode === 'select' && !document.querySelector('#folders .part.act'))]);
  await arm(); await ed.keyboard.press('Escape'); await ed.waitForTimeout(150);
  results.push(['Inserção: Esc cancela', !(await st()).placing]);
  await arm(); await ed.click('#folders [data-part="bobina"]'); await ed.waitForTimeout(150);
  results.push(['Inserção: clicar de novo no item ativo cancela', !(await st()).placing]);
  await arm(); await ed.click('[data-folder="Contatores e relés"]'); await ed.waitForTimeout(350);
  [gx, gy] = await scr(1000, 700); await ed.mouse.click(gx, gy); await ed.waitForTimeout(150);
  s1 = await st();
  results.push(['Inserção: fechar a categoria encerra a ferramenta (sem inserção invisível)', !s1.placing && s1.n === n0 + 5 && !await ed.evaluate(() => document.getElementById('drawer').classList.contains('open'))]);
  // smart guides on the insertion preview, at two zoom/pan states
  const k1 = await ed.evaluate(() => { const c = window.__va.doc().comps.find(c => c.tag === 'K1' && c.type === 'bobina'); return { x: c.x, y: c.y }; });
  const before = await ed.evaluate(() => JSON.stringify(window.__va.doc().comps.map(c => [c.id, c.x, c.y])) + window.__va.doc().wires.length);
  const guideAt = async () => ed.evaluate(() => [...document.querySelectorAll('#cv .sguides line')].map(l => ({ v: l.getAttribute('x1') === l.getAttribute('x2'), x: +l.getAttribute('x1'), y: +l.getAttribute('y1') })));
  const centre = z => ed.evaluate(([k, z]) => { const va = window.__va, r = document.getElementById('cv').getBoundingClientRect(); va.ui.zoom = z; va.ui.px = r.width / 2 - k.x * z; va.ui.py = r.height * .4 - k.y * z; va.render(); }, [k1, z]);
  await centre(1); await ed.waitForTimeout(80);
  await arm();
  [gx, gy] = await scr(k1.x, k1.y + 150); await ed.mouse.move(gx, gy); await ed.waitForTimeout(80);
  const g1 = await guideAt();
  await centre(1.7); await ed.waitForTimeout(100);
  [gx, gy] = await scr(k1.x + 2, k1.y + 110); await ed.mouse.move(gx, gy); await ed.waitForTimeout(80);
  const g2 = await guideAt();
  [gx, gy] = await scr(k1.x + 200, k1.y + 3); await ed.mouse.move(gx, gy); await ed.waitForTimeout(80);
  const g3 = await guideAt();
  [gx, gy] = await scr(k1.x + 157, k1.y + 97); await ed.mouse.move(gx, gy); await ed.waitForTimeout(80);
  const g4 = await guideAt();
  const kc = await ed.evaluate(() => { const c = window.__va.doc().comps.find(c => c.tag === 'K1' && c.type === 'bobina'), r = [c.x, c.y]; return r; });
  results.push(['Guias: vertical no mesmo X e horizontal no mesmo Y, com zoom e pan', g1.some(g => g.v && Math.abs(g.x - kc[0]) < 1) && g2.some(g => g.v && Math.abs(g.x - kc[0]) < 1) && g3.some(g => !g.v && Math.abs(g.y - kc[1]) < 1) && !g4.length]);
  await ed.keyboard.press('Escape'); await ed.waitForTimeout(150);
  results.push(['Guias: somem ao cancelar e não alteram posições nem conexões', !(await guideAt()).length && await ed.evaluate(b => JSON.stringify(window.__va.doc().comps.map(c => [c.id, c.x, c.y])) + window.__va.doc().wires.length === b, before)]);
  // guides while moving a component; temporary and never exported
  await centre(1); await ed.waitForTimeout(80);
  const h1 = await ed.evaluate(k => { const va = window.__va, c = va.addComp('bobina', k.x + 200, k.y + 120); va.commitNow(); va.render(); return { id: c.id, x: c.x, y: c.y }; }, k1);
  await ed.waitForTimeout(80);
  const [hx0, hy0] = await scr(h1.x, h1.y); await ed.mouse.move(hx0, hy0); await ed.mouse.down();
  const [hx1, hy1] = await scr(kc[0], h1.y + 3); await ed.mouse.move(hx1, hy1, { steps: 6 }); await ed.waitForTimeout(80);
  const gm = await guideAt(), exp = await ed.evaluate(() => window.__va.sheetSVGFor ? '' : '');
  await ed.mouse.up(); await ed.waitForTimeout(120);
  results.push(['Guias: aparecem ao mover um componente e somem ao soltar', gm.some(g => g.v && Math.abs(g.x - kc[0]) < 1) && !(await guideAt()).length]);
  results.push(['Guias: não fazem parte da folha exportada', await ed.evaluate(() => { window.__va.ui.guides = [{ dir: 'v', x: 10, a: 0, b: 10 }]; const s = window.__va.exportSheetSVG(); window.__va.ui.guides = null; return !/class="sguides"/.test(s) && !/class="ghost"/.test(s); })]);
  await ed.close();
}
// ---- Catálogo de contatores e relés, BOM, capa e PDF completo ----
{
  const ct = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  ct.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await ct.goto(page); await ct.waitForTimeout(500);
  results.push(['Catálogo: duas categorias com dez fabricantes cada e 7 referências verificadas', await ct.evaluate(() => { const va = window.__va, m = k => new Set(va.CATALOG_FAMILIES.filter(f => f.kind === k).map(f => f.manufacturer)).size; return m('contactor') === 10 && m('interface_relay') === 10 && va.CATALOG_REFS.length === 7 && va.CATALOG_REFS.every(r => r.verificationStatus === 'verified' && r.sourceUrl); })]);
  results.push(['Catálogo: sem combinações inválidas (corrente/bobina fora da família, CA≠CC, ref de outro tipo)', await ct.evaluate(() => { const D = window.__va.DeviceCatalog;
    const a = D.sanitize({ kind: 'contactor', status: 'pending', manufacturer: 'WEG', family: 'CWB / CWM', supply: 'AC', vmin: 24, vmax: 24, currentA: 7 });
    const b = D.sanitize({ kind: 'contactor', status: 'pending', manufacturer: 'Metaltex', family: 'CT', supply: 'DC', vmin: 220, vmax: 220, currentA: 9 });
    const c = D.sanitize({ kind: 'interface_relay', status: 'verified', refId: 'schneider-lc1d09m7' });
    const d = D.sanitize({ kind: 'contactor', status: 'generic', supply: 'AC', vmin: 120, vmax: 120, currentA: 9, manufacturer: 'Inventada', model: 'XYZ-1' });
    return a.vmin === 24 && a.currentA === undefined && b.vmin === undefined && b.currentA === 9 && !c.refId && !c.model && d.manufacturer === '' && d.model === '' && d.vmin === 120; })]);
  await ct.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); va.setView('diagram'); const k = va.doc().comps.find(c => c.type === 'bobina'); va.ui.sheet = k.sheet; va.ui.sel = { kind: 'comp', id: k.id }; va.ui.inspOpen = true; va.ui.pmTab = 'props'; va.render(); });
  await ct.waitForTimeout(400);
  const kSpec = () => ct.evaluate(() => { const k = window.__va.doc().comps.find(c => c.type === 'bobina'); return { s: k.spec || null, vn: k.vn, vk: k.vk, tmin: k.tmin, tmax: k.tmax }; });
  await ct.selectOption('#sp_status', 'verified'); await ct.waitForTimeout(150); await ct.selectOption('#sp_refId', 'schneider-lc1d09m7'); await ct.waitForTimeout(200);
  let ks = await kSpec();
  results.push(['Contator verificado: fabricante, modelo, bobina e corrente da ficha', ks.s.status === 'verified' && ks.s.manufacturer === 'Schneider Electric' && ks.s.model === 'LC1D09M7' && ks.s.supply === 'AC' && ks.s.vmin === 220 && ks.s.currentA === 9 && ks.s.basis === 'AC-3' && ks.vn === 220 && ks.vk === 'CA']);
  results.push(['Contator verificado: identificação compacta no diagrama e campos de bobina bloqueados', await ct.evaluate(() => [...document.querySelectorAll('#cv .devid')].some(t => t.textContent === 'LC1D09M7') && document.querySelector('#insp [data-prop="vn"]').disabled && /Verificado/.test(document.querySelector('#insp .spec').textContent))]);
  // simulation preserved with the catalogued coil
  results.push(['Contator do catálogo: energiza e desenergiza como antes', await ct.evaluate(() => { const va = window.__va, tag = t => va.doc().comps.find(c => c.tag === t && !va.TYPES[c.type].ref); va.startSim(); va.sim.pressed.add(tag('S1').id); va.solve(); va.sim.pressed.clear(); va.solve(); const on = !!va.sim.coils.K1; va.sim.pressed.add(tag('S0').id); va.solve(); va.sim.pressed.clear(); va.solve(); const off = !va.sim.coils.K1; va.stopSim(); return on && off; })]);
  await ct.evaluate(() => window.__va.render()); await ct.waitForTimeout(200);
  // switching to an interface relay warns before (power contacts exist) and changes nothing on cancel
  const topo = await ct.evaluate(() => JSON.stringify(window.__va.doc().comps.map(c => [c.id, c.type, c.tag])) + JSON.stringify(window.__va.doc().wires.map(w => [w.a, w.b])));
  await ct.selectOption('#sp_kind', 'interface_relay'); await ct.waitForTimeout(250);
  results.push(['Relé: troca de tipo com contatos de força avisa antes de aplicar', await ct.evaluate(() => !document.getElementById('modal').hidden && /contatos? de força/.test(document.getElementById('modal').textContent))]);
  await ct.click('#spCancel'); await ct.waitForTimeout(200);
  ks = await kSpec();
  results.push(['Relé: cancelar mantém o contator e a topologia', ks.s.kind === 'contactor' && ks.s.model === 'LC1D09M7' && await ct.evaluate(t => JSON.stringify(window.__va.doc().comps.map(c => [c.id, c.type, c.tag])) + JSON.stringify(window.__va.doc().wires.map(w => [w.a, w.b])) === t, topo)]);
  await ct.selectOption('#sp_kind', 'interface_relay'); await ct.waitForTimeout(200); await ct.click('#spOk'); await ct.waitForTimeout(200);
  await ct.selectOption('#sp_status', 'verified'); await ct.waitForTimeout(150); await ct.selectOption('#sp_refId', 'phoenix-2966171'); await ct.waitForTimeout(200);
  ks = await kSpec();
  results.push(['Relé tipo borne verificado (Phoenix 2966171): 24 Vcc, 6 A, fios e contatos intactos', ks.s.kind === 'interface_relay' && ks.s.supply === 'DC' && ks.s.vmin === 24 && ks.s.currentA === 6 && ks.s.basis === 'carga resistiva' && ks.vk === 'CC' && ks.vn === 24 && await ct.evaluate(t => JSON.stringify(window.__va.doc().comps.map(c => [c.id, c.type, c.tag])) + JSON.stringify(window.__va.doc().wires.map(w => [w.a, w.b])) === t, topo)]);
  await ct.selectOption('#sp_status', 'generic'); await ct.waitForTimeout(150);
  const coilOpts = await ct.evaluate(() => [...document.querySelectorAll('#sp_coil option')].map(o => o.value).filter(Boolean));
  await ct.selectOption('#sp_coil', 'DC:24:24'); await ct.waitForTimeout(150); await ct.selectOption('#sp_currentA', '6'); await ct.waitForTimeout(200);
  ks = await kSpec();
  results.push(['Relé genérico: sem marca nem SKU, CA e CC separados', ks.s.status === 'generic' && ks.s.manufacturer === '' && ks.s.model === '' && ks.s.currentA === 6 && ks.vk === 'CC' && coilOpts.includes('AC:24:24') && coilOpts.includes('DC:24:24') && !coilOpts.some(v => v.startsWith('AC_DC'))]);
  // ABB AF range coil (pending family) → CA/CC band mapped to the existing rating fields
  await ct.selectOption('#sp_kind', 'contactor'); await ct.waitForTimeout(150); await ct.selectOption('#sp_status', 'pending'); await ct.waitForTimeout(150);
  await ct.selectOption('#sp_manufacturer', 'ABB'); await ct.waitForTimeout(150); await ct.selectOption('#sp_coil', 'AC_DC:100:250'); await ct.waitForTimeout(150); await ct.selectOption('#sp_currentA', '26'); await ct.waitForTimeout(200);
  ks = await kSpec();
  results.push(['Família pendente (ABB AF): faixa 100–250 V CA/CC e status pendente sinalizado', ks.s.status === 'pending' && ks.s.family === 'AF' && ks.vk === 'CA/CC' && ks.tmin && ks.tmax && Math.round(ks.vn * ks.tmin / 100) === 100 && Math.round(ks.vn * ks.tmax / 100) === 250 && await ct.evaluate(() => /pendentes?/i.test(document.querySelector('#insp .spec').textContent) && [...document.querySelectorAll('#cv .devid')].some(t => /\*$/.test(t.textContent)))]);
  // BOM: one physical device per association, live updates, same source for Listas and PDF
  const bom = () => ct.evaluate(() => { const B = window.__va.bomOf(); return { rows: B.rows.map(r => ({ tags: r.tags.join(','), model: r.model, status: r.status, qty: r.qty, coil: r.coil, cat: r.category })), devices: B.devices, symbols: B.symbols, rev: B.rev }; });
  let B = await bom();
  const kRow = B.rows.find(r => r.tags.split(',').includes('K1'));
  results.push(['BOM: bobina, contatos de força e auxiliares de K1 contam um dispositivo', kRow && kRow.qty === 1 && B.symbols > B.devices && B.rows.filter(r => r.tags.split(',').includes('K1')).length === 1 && kRow.status === 'pending' && /CA\/CC/.test(kRow.coil)]);
  await ct.evaluate(() => { const va = window.__va; va.setView('tags'); });
  await ct.waitForTimeout(200);
  const rev0 = await ct.evaluate(() => +document.querySelector('.docsec').dataset.rev);
  await ct.evaluate(() => { const va = window.__va, m = va.doc().comps.find(c => c.type.startsWith('motor')); m.tag = 'M9'; va.addComp('sinaleiro', 300, 300, { sheet: va.doc().sheets[1].id, color: 'vermelho' }); va.commitNow(); va.render(); });
  await ct.waitForTimeout(150);
  B = await bom();
  results.push(['BOM e Listas atualizam sozinhas após editar TAG e inserir componente', B.rows.some(r => r.tags.split(',').includes('M9')) && B.rows.some(r => /Sinaleiro/.test(r.model) && r.qty >= 1) && await ct.evaluate(r => +document.querySelector('.docsec').dataset.rev > r && /M9/.test(document.getElementById('bomSec').textContent), rev0)]);
  await ct.evaluate(() => { document.getElementById('bUndo').click(); }); await ct.waitForTimeout(150);
  results.push(['BOM acompanha desfazer', await ct.evaluate(() => !window.__va.bomOf().rows.some(r => /vermelho/.test(r.model + r.spec) || r.tags.includes('M9')) && !/M9/.test(document.getElementById('bomSec').textContent))]);
  // persistence: save → reopen keeps the spec; repeated import does not duplicate
  const saved = await ct.evaluate(() => window.__va.serialize());
  results.push(['Dispositivo persistido e restaurado ao salvar/reabrir (sem duplicar em importações repetidas)', await ct.evaluate(s => { const va = window.__va; va.load(s); va.load(s); const k = va.doc().comps.find(c => c.type === 'bobina'); const B = va.bomOf(); return k.spec && k.spec.family === 'AF' && k.spec.vmin === 100 && va.doc().comps.length === JSON.parse(s).comps.length && B.rows.filter(r => r.tags.includes('K1')).length === 1; }, saved)]);
  results.push(['Projeto antigo sem catálogo: bobina genérica não especificada', await ct.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); const r = va.bomOf().rows.find(r => r.tags.includes('K1')); return r && r.status === 'generic' && /não especificado/.test(r.model); })]);
  // new project dialog: cover identity + preview; skip keeps defaults
  await ct.evaluate(() => { window.__va.setView('home'); window.__va.homeSelect(2); }); await ct.waitForTimeout(950); await ct.click('#opGo'); await ct.waitForTimeout(900);
  results.push(['Novo projeto: campos de capa (empresa, logo, autor, descrição, data) e prévia', await ct.evaluate(() => ['#dCompany', '#dPDesc', '#dLogo', '#dAuth', '#dDate', '#dProj'].every(q => document.querySelector(q)) && /VOLT/.test(document.getElementById('dCover').textContent))]);
  await ct.setInputFiles('#dLogo', { name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') }); await ct.waitForTimeout(150);
  results.push(['Logo: formato inválido é recusado', await ct.evaluate(() => /Formato não suportado/.test(document.getElementById('dMsg').textContent) && !document.querySelector('#dLogoBox img'))]);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAIAAAAphe5+AAAAM0lEQVR4nO3PQQ0AMAjAQMAIjlCG6Ing0SzpKWizZ+NnRQdcOUBzgOYAzQGaAzQHaA7QHob1ARkpGjKbAAAAAElFTkSuQmCC', 'base64');
  await ct.setInputFiles('#dLogo', { name: 'logo.png', mimeType: 'image/png', buffer: png }); await ct.waitForTimeout(400);
  await ct.fill('#dProj', 'Bombas da ETA'); await ct.fill('#dCompany', 'Saneamento Sul'); await ct.fill('#dPDesc', 'Comando de duas bombas com alternância'); await ct.fill('#dAuth', 'Ana');
  await ct.waitForTimeout(150);
  results.push(['Logo: proporção preservada e prévia da capa atualizada ao digitar', await ct.evaluate(() => { const i = document.querySelector('#dCover img'); return !!i && /^data:image\/png/.test(i.src) && Math.abs(i.naturalWidth / i.naturalHeight - 4) < .05 && /Saneamento Sul/.test(document.getElementById('dCover').textContent) && /Bombas da ETA/.test(document.getElementById('dCover').textContent); })]);
  await ct.click('#dSave'); await ct.waitForTimeout(700);
  results.push(['Capa: identidade persistida com o projeto (salvar/reabrir)', await ct.evaluate(() => { const va = window.__va, s = JSON.parse(va.serialize()); va.load(va.serialize()); const d = va.doc(); return s.company === 'Saneamento Sul' && /^data:image\/png/.test(s.logo) && d.company === 'Saneamento Sul' && d.pdesc === 'Comando de duas bombas com alternância' && /^data:image/.test(d.logo); })]);
  results.push(['Capa personalizada: título, empresa, logo e metadados; sem placeholders vazios', await ct.evaluate(() => { const va = window.__va, s = va.coverSVG(va.planDocument()); return /Bombas da ETA/.test(s) && /Saneamento Sul/.test(s) && /<image href="data:image\/png/.test(s) && /preserveAspectRatio="xMinYMid meet"/.test(s) && /AUTOR/.test(s) && !/undefined|null/.test(s); })]);
  results.push(['Capa padrão: sem identidade usa VoltAcademy e omite campos vazios', await ct.evaluate(() => { const va = window.__va, d = va.doc(), keep = [d.company, d.logo, d.author]; d.company = ''; d.logo = ''; d.author = ''; const s = va.coverSVG(va.planDocument()); [d.company, d.logo, d.author] = keep; return /VOLT/.test(s) && /ACADEMY/.test(s) && !/AUTOR/.test(s) && !/EMPRESA/.test(s) && !/<image/.test(s); })]);
  // full PDF: real pagination with multipage BOM and index, synced without saving
  const exp = () => ct.evaluate(async () => { const va = window.__va, b = await va.exportPDF({ dpi: 40 }), t = new TextDecoder('latin1').decode(await b.arrayBuffer()); return { ...b.meta, pdfPages: (t.match(/\/Type \/Page\b/g) || []).length, cur: { rev: va.rev(), project: va.doc().project, sheets: va.doc().sheets.map(s => s.name), bomRows: va.bomOf().rows.length } }; });
  await ct.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[1].build()); });
  let m = await exp();
  const contiguous = mm => mm.entries.every((e, i) => i === 0 ? e.page === 1 : e.page === mm.entries[i - 1].page + mm.entries[i - 1].n) && mm.total === mm.entries.reduce((a, e) => a + e.n, 0);
  results.push(['PDF: capa, índice, folhas na ordem real, lista de materiais e paginação correta', m.pdfPages === m.total && contiguous(m) && m.entries[0].k === 'cover' && m.entries.filter(e => e.k === 'sheet').map(e => e.title).join('|') === 'Folha 1 · Força|Folha 2 · Comando' && m.bomRows === m.cur.bomRows && m.rev === m.cur.rev]);
  await ct.evaluate(() => { const va = window.__va, d = va.doc(); d.sheets.push({ id: 's9', name: 'Sinalização', desc: '', size: 'A4', orient: 'paisagem', cols: 8, rows: 5 }); d.sheets[0].name = 'Potência'; d.project = 'Projeto renomeado'; va.commitNow(); });
  m = await exp();
  results.push(['PDF sem salvar: nova folha, renomeação e nome do projeto entram na próxima exportação', m.pdfPages === m.total && contiguous(m) && m.project === 'Projeto renomeado' && m.entries.filter(e => e.k === 'sheet').map(e => e.title).join('|') === 'Folha 1 · Potência|Folha 2 · Comando|Folha 3 · Sinalização' && m.rev === m.cur.rev]);
  await ct.evaluate(() => { const va = window.__va, d = va.doc(); d.sheets = d.sheets.filter(s => s.id !== 's9'); va.commitNow(); });
  m = await exp();
  results.push(['PDF: excluir folha atualiza índice e páginas, sem dados antigos', m.pdfPages === m.total && contiguous(m) && m.entries.filter(e => e.k === 'sheet').length === 2 && !m.entries.some(e => /Sinalização/.test(e.title))]);
  await ct.evaluate(() => { const va = window.__va, sid = va.doc().sheets[1].id; for (let i = 0; i < 40; i++) va.addComp('motor_3f', 200 + (i % 8) * 120, 200 + Math.floor(i / 8) * 120, { sheet: sid, kw: 0.25 + i * 0.25 }); for (let i = 0; i < 16; i++) va.doc().sheets.push({ id: 'x' + i, name: 'Extra ' + (i + 1), desc: '', size: 'A4', orient: 'paisagem', cols: 8, rows: 5 }); va.commitNow(); });
  m = await exp();
  const bomE = m.entries.find(e => e.k === 'bom'), idxE = m.entries.find(e => e.k === 'index');
  results.push(['PDF: lista de materiais e índice multipágina com páginas reais', bomE.n >= 3 && idxE.n === 2 && m.pdfPages === m.total && contiguous(m) && m.bomRows === m.cur.bomRows]);
  results.push(['BOM multipágina: cabeçalho repetido nas páginas seguintes', await ct.evaluate(() => { const va = window.__va, pl = va.planDocument(), pg = va.__bom(pl); return pg.length >= 3 && pg.every(s => /Família \/ modelo/.test(s) && /TAG\(s\)/.test(s)) && pg.slice(1).every(s => /continuação/.test(s)) && pg.every((s, i) => s.includes(`Página ${pl.entries.find(e => e.k === 'bom').page + i} de ${pl.total}`)); })]);
  results.push(['PDF: guias, seleção e prévias da interface não entram nas folhas', await ct.evaluate(() => { const va = window.__va; va.ui.guides = [{ dir: 'h', y: 10, a: 0, b: 10 }]; va.ui.sel = { kind: 'comp', id: va.doc().comps[0].id }; const s = va.exportSheetSVG(); va.ui.guides = null; return !/class="sguides"|class="comp sel|class="ghost"|jarvis/.test(s); })]);
  await ct.close();
}
// ---- Interface global e sessão (VOLT CORE em todas as telas, sem ativação automática) ----
{
  const ss = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  ss.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await ss.goto(page); await ss.waitForTimeout(700);
  const view = async v => { await ss.evaluate(v => window.__va.setView(v), v); await ss.waitForTimeout(450); };
  results.push(['Sessão: inicia ociosa (idle, sem projeto ativo, simulação parada, sem salvo)', await ss.evaluate(() => { const S = window.__va.Session; return S.status === 'idle' && S.activeProject === null && !S.simulationRunning && S.lastSavedProject === null && window.__va.doc().comps.length === 0; })]);
  results.push(['Sessão: cabeçalho e início mostram "Nenhum projeto ativo"', await ss.evaluate(() => document.getElementById('projName').textContent === 'Nenhum projeto ativo' && document.getElementById('homeProj').textContent === 'Nenhum projeto ativo')]);
  results.push(['Sessão: Continuar indisponível sem projeto salvo', await ss.evaluate(() => { window.__va.homeSelect(1); return document.getElementById('opGo').disabled && /nenhum projeto salvo/i.test(document.getElementById('opDesc').textContent); })]);
  await ss.waitForTimeout(950); await ss.click('.jmod[data-op="1"]', { force: true }); await ss.waitForTimeout(700);
  results.push(['Sessão: confirmar Continuar sem salvo não ativa nada', await ss.evaluate(() => window.__va.ui.view === 'home' && !window.__va.Session.active)]);
  await ss.evaluate(() => window.__va.homeSelect(3)); await ss.waitForTimeout(1200);
  results.push(['Sessão: selecionar módulos no carrossel não ativa projeto', await ss.evaluate(() => !window.__va.Session.active && window.__va.doc().comps.length === 0)]);
  await view('diagram');
  results.push(['Diagrama em espera: prancheta vazia com mensagem e ferramentas bloqueadas', await ss.evaluate(() => { const w = document.getElementById('waitDiagram'); return !w.hidden && /AGUARDANDO INICIALIZAÇÃO DO PROJETO/.test(w.textContent) && getComputedStyle(document.getElementById('cv')).visibility === 'hidden' && getComputedStyle(document.getElementById('rail')).pointerEvents === 'none' && document.getElementById('bRun').disabled; })]);
  results.push(['Diagrama em espera: atalhos e simulação não alteram nada', await ss.evaluate(() => { const va = window.__va; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })); va.startSim(); return !va.sim.running && va.doc().comps.length === 0 && !localStorage.getItem('voltacademy.ce.doc'); })]);
  await view('operate');
  results.push(['HMI em espera: VOLT CORE central sem módulos orbitais e Simular desabilitado', await ss.evaluate(() => { const o = document.getElementById('vOperate'); return !!o.querySelector('#hmiAnchor') && /AGUARDANDO APLICAÇÃO/.test(o.textContent) && !o.querySelector('.jmod, .opbtn, .hmi') && document.body.classList.contains('hmi-wait') && document.getElementById('bRun').disabled && (!window.__va.JarvisCore.ok || document.body.classList.contains('core-on')); })]);
  await view('tags');
  results.push(['Listas sem projeto: "Nenhum material disponível"', await ss.evaluate(() => /Nenhum material disponível/.test(document.getElementById('vTags').textContent) && !document.querySelector('#vTags table'))]);
  await view('monitor');
  results.push(['Monitoramento sem projeto: em espera, sem dados', await ss.evaluate(() => /MONITORAMENTO EM ESPERA/.test(document.getElementById('vMonitor').textContent) && !document.querySelector('#vMonitor .readout, #vMonitor svg'))]);
  results.push(['Camada global: cabeçalho sem fundo/borda e efeitos sem capturar o ponteiro', await ss.evaluate(() => { const t = getComputedStyle(document.querySelector('.top')), bg = getComputedStyle(document.getElementById('voltBg')); return /rgba\(0, 0, 0, 0\)|transparent/.test(t.backgroundColor) && t.borderBottomWidth === '0px' && t.boxShadow === 'none' && bg.pointerEvents === 'none' && bg.position === 'fixed' && document.getElementById('jarvisNet').parentElement.id === 'voltBg'; })]);
  results.push(['VOLT CORE: STANDBY sem projeto', await ss.evaluate(() => window.__va.VoltState.state === 'STANDBY')]);
  // Novo projeto pelo início → editor habilitado
  await view('home'); await ss.evaluate(() => window.__va.homeSelect(2)); await ss.waitForTimeout(950); await ss.click('#opGo'); await ss.waitForTimeout(400);
  await ss.click('#dSkip'); await ss.waitForTimeout(600);
  results.push(['Novo projeto: ativa a sessão e habilita o editor', await ss.evaluate(() => { const va = window.__va; return va.Session.active && va.ui.view === 'diagram' && document.getElementById('waitDiagram').hidden && getComputedStyle(document.getElementById('rail')).pointerEvents !== 'none' && !document.getElementById('bRun').disabled && document.getElementById('projName').textContent === va.doc().project && va.doc().sheets.length >= 1; })]);
  results.push(['VOLT CORE: INITIALIZING/SUCCESS na ativação e depois READY', await ss.evaluate(async () => { const a = window.__va.VoltState.state; await new Promise(r => setTimeout(r, 1900)); return ['INITIALIZING', 'SUCCESS'].includes(a) && window.__va.VoltState.state === 'READY'; })]);
  // carregar exemplo → HMI correspondente; navegação durante a simulação
  await ss.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[0].build()); va.setView('operate'); }); await ss.waitForTimeout(500);
  results.push(['Exemplo: HMI real substitui a espera', await ss.evaluate(() => !document.querySelector('#vOperate .hmiwait') && !!document.getElementById('opRun') && !document.body.classList.contains('hmi-wait'))]);
  await ss.evaluate(() => { const va = window.__va; va.startSim(); va.sim.pressed.add(va.doc().comps.find(c => c.tag === 'S1').id); va.solve(); va.sim.pressed.clear(); va.solve(); }); await ss.waitForTimeout(300);
  const t0 = await ss.evaluate(() => window.__va.sim.t);
  for (const v of ['diagram', 'monitor', 'tags', 'home', 'operate']) await view(v);
  results.push(['Navegação durante simulação preserva sincronismo e estado elétrico', await ss.evaluate(t0 => { const va = window.__va; return va.sim.running && va.sim.coils.K1 && va.sim.t > t0 + 1 && va.Session.simulationRunning && va.VoltState.state === 'SIMULATING'; }, t0)]);
  await ss.evaluate(() => window.__va.stopSim());
  // efeitos não interferem na edição
  await view('diagram');
  results.push(['Efeitos não interferem: o elemento sob o cursor na prancheta é o desenho', await ss.evaluate(() => { const r = document.getElementById('cv').getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && !!el.closest('#cv'); })]);
  // projeto salvo → nova sessão: referência sem ativação, Continuar restaura integralmente
  const saved = await ss.evaluate(() => localStorage.getItem('voltacademy.ce.doc'));
  await ss.reload(); await ss.waitForTimeout(800);
  results.push(['Sessão com projeto salvo: referência disponível, sem ativação automática', await ss.evaluate(() => { const va = window.__va, S = va.Session; return !S.active && S.lastSavedProject && S.lastSavedProject.project === 'Partida direta com selo' && va.doc().comps.length === 0 && !va.sim.running && document.getElementById('projName').textContent === 'Nenhum projeto ativo'; })]);
  await view('operate');
  results.push(['HMI após reinício: espera, sem aplicação antiga', await ss.evaluate(() => !!document.querySelector('#vOperate .hmiwait') && !document.getElementById('opRun'))]);
  await view('monitor');
  results.push(['Monitoramento após reinício: sem dados da sessão anterior', await ss.evaluate(() => /EM ESPERA/.test(document.getElementById('vMonitor').textContent) && window.__va.sim.events.length === 0)]);
  await view('home'); await ss.evaluate(() => window.__va.homeSelect(1)); await ss.waitForTimeout(950);
  results.push(['Continuar mostra o último salvo apenas como referência', await ss.evaluate(() => !document.getElementById('opGo').disabled && /Partida direta com selo/.test(document.getElementById('opCount').textContent) && !window.__va.Session.active)]);
  await ss.click('#opGo'); await ss.waitForTimeout(900);
  results.push(['Continuar projeto recupera integralmente o trabalho salvo', await ss.evaluate(s => { const va = window.__va; return va.Session.active && va.ui.view === 'diagram' && JSON.stringify(JSON.parse(va.serialize()).comps) === JSON.stringify(JSON.parse(s).comps) && JSON.stringify(JSON.parse(va.serialize()).wires) === JSON.stringify(JSON.parse(s).wires) && va.doc().project === JSON.parse(s).project; }, saved)]);
  // falha no carregamento não ativa nem sobrescreve
  await ss.reload(); await ss.waitForTimeout(700);
  results.push(['Falha no carregamento não ativa projeto nem sobrescreve o salvo', await ss.evaluate(s => { const va = window.__va; try { va.load('{"comps": [{"type": "inexistente"}], "wires": []}'); } catch (e) {} return !va.Session.active && localStorage.getItem('voltacademy.ce.doc') === s; }, saved)]);
  await ss.close();
}
const jr = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
await jr.goto(page); await jr.waitForTimeout(1200);
results.push(['Jarvis: respeita redução de movimento', await jr.evaluate(() => window.__va.Orbit.sway === 0 && matchMedia('(prefers-reduced-motion: reduce)').matches)]);
await jr.close();

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

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

  check('Biblioteca com 50 componentes (inclui buzzer, buzina, sirene e transformadores)', Object.keys(va.TYPES).length === 50);
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
results.push(['Início: carrossel com 4 operações a 90°', await p.evaluate(() => window.__va.HOME_OPS.length === 4 && document.querySelectorAll('#opDots .hdot').length === 4)]);
await p.keyboard.press('ArrowRight'); await p.waitForTimeout(950);
results.push(['Início: seta gira o carrossel e o núcleo reage', await p.evaluate(() => { const H = window.__va.Home; return H.sel === 1 && Math.abs(H.rot - Math.PI / 2) < 0.05 && /Continuar/.test(document.getElementById('opTitle').textContent); })]);
await p.evaluate(() => window.__va.homeSelect(3)); await p.waitForTimeout(950);
await p.click('#opGo'); await p.waitForTimeout(700);
results.push(['Início: confirmar Exemplos abre o Project Lab com a biblioteca real', await p.evaluate(() => window.__va.ui.view === 'lab' && document.querySelectorAll('#labList .lab-item').length === 4)]);
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
results.push(['PDF: arquivo válido com folhas e relatório', pdf.slice(0, 5).toString() === '%PDF-' && pdf.slice(-6).toString().includes('%%EOF') && pagesN === 4]);

// ---- Biblioteca retrátil (activeCategory) e Active Energy UI ----
const fresh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await fresh.goto(page); await fresh.waitForTimeout(500); await fresh.evaluate(() => window.__va.setView('diagram'));
results.push(['Biblioteca: começa fechada e sem categoria ativa', await fresh.evaluate(() => window.__va.ui.activeCategory === null && !document.getElementById('drawer').classList.contains('open') && !document.querySelector('.railb.act'))]);
const geo0 = await fresh.evaluate(() => ({ w: document.getElementById('cv').getBoundingClientRect().width, z: window.__va.ui.zoom, px: window.__va.ui.px }));
await fresh.click('[data-folder="Comando"]'); await fresh.waitForTimeout(350);
results.push(['Biblioteca: clicar abre só os componentes da categoria', await fresh.evaluate(() => { const parts = [...document.querySelectorAll('#folders [data-part]')].map(b => window.__va.TYPES[b.dataset.part].cat); return document.getElementById('drawer').classList.contains('open') && parts.length === 12 && parts.every(c => c === 'Comando') && !document.querySelector('details.folder'); })]);
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
await ev.evaluate(() => { const va = window.__va; va.load(va.EXAMPLES[2].build()); va.setView('home'); va.homeSelect(0); });
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
await ev.evaluate(() => { window.__va.setView('home'); window.__va.homeSelect(0); window.__va.homeConfirm(); }); await ev.waitForTimeout(800);
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
results.push(['Painel: clicar na folha troca a folha ativa, o canvas e o indicador', await pm.evaluate(() => { const va = window.__va, s = va.doc().sheets[1]; return va.ui.sheet === s.id && document.querySelector('#tabs .srow.act').dataset.sheet === s.id && /Folha 02 — Comando/.test(document.getElementById('sheetBadge').textContent) && document.querySelectorAll('#world [data-comp]').length === va.doc().comps.filter(c => c.sheet === s.id).length; })]);
await pm.click('#sNew'); await pm.waitForTimeout(150); await pm.fill('#dName', 'Sinalização'); await pm.click('#dSave'); await pm.waitForTimeout(200);
results.push(['Painel: + Nova folha pede o nome, atualiza a tabela e seleciona a folha', await pm.evaluate(() => { const va = window.__va, d = va.doc(), s = d.sheets[d.sheets.length - 1]; return d.sheets.length === 3 && s.name === 'Sinalização' && va.ui.sheet === s.id && document.querySelectorAll('#tabs .srow').length === 3 && document.querySelector('#tabs .srow.act .snm').textContent === 'Sinalização' && /03 — Sinalização/.test(document.getElementById('sheetBadge').textContent); })]);
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

# VoltAcademy

Plataforma educacional de simuladores elétricos. Este repositório começa pelo **Simulador de
Comandos Elétricos**, que já funciona de ponta a ponta.

## Ver o programa rodando

- **Sem instalar nada:** abra `dist/VoltAcademy-Comandos-Eletricos.html` com dois cliques
  (Chrome, Edge ou Firefox). No Windows, também dá para usar `INICIAR-SIMULADOR.bat`.
- **Online:** a mesma página está publicada no Claude (link privado do dono da conta).

Ao abrir, o circuito "Partida direta com selo" já vem carregado. Aperte **SIMULAR**, segure
**S1** para ligar o contator K1 e segure **S0** para desligar.

## O que o simulador faz
- Paleta IEC com 19 componentes: fase, neutro, ponto de conexão, botões NA/NF, emergência,
  chave seletora, sensor indutivo, bobina de contator, contatos auxiliares NA/NF, bobina
  temporizada (retardo na energização) e seus contatos, disjuntor, fusível, contatos do relé
  térmico (95-96 / 97-98) e sinaleiro com cor.
- Fios em 8 cores, com rota automática ou pontos de dobra; bornes numerados (13-14, 21-22, A1-A2…).
- Folha técnica com régua 1–12 / A–F e carimbo (projeto, autor, data, folha).
- Simulação: selo, intertravamento, temporizador com contagem, desarme do relé térmico,
  sinalização, condutores energizados (fase em vermelho, neutro em azul), **detecção de
  curto-circuito** e aviso de circuito oscilante.
- Avisos de projeto: contato sem bobina com a mesma tag, componente sem ligação, falta de fase ou neutro.
- Desfazer/refazer, zoom (roda do mouse ou pinça no celular), salvamento automático no
  navegador e exportação/importação do projeto em JSON.
- 3 circuitos de exemplo com roteiro de teste: partida direta, reversão com intertravamento e
  partida com sinalização temporizada.

## Desenvolvimento
```bash
node scripts/build-standalone.mjs
```
```bash
node tests/simulacao.test.mjs
```
Os testes usam Playwright (`npm i -D playwright`) e cobrem o motor de simulação, a interação
com o mouse e o layout no celular.

## Estrutura
| Pasta | Conteúdo |
|---|---|
| `simulador/` | Código-fonte do simulador (HTML + CSS + JS em um arquivo) |
| `dist/` | Versão executável gerada |
| `tests/` | Testes automatizados |
| `docs/` | Arquitetura e pendências do projeto |

## Origem
Todo o código foi escrito do zero para a VoltAcademy.

# 05 — Arquitetura da VoltAcademy

## Proposta
| Camada | Escolha | Por quê |
|---|---|---|
| Simuladores | Módulos web independentes (HTML/JS/SVG), um por área | Rodam sozinhos (como já roda o de Comandos Elétricos), podem ser testados isolados e embutidos na plataforma |
| Frontend da plataforma | Next.js + React + TypeScript | Mesmo modelo de rotas da referência (área do aluno, admin), SSR para a landing e SEO |
| API | Node.js (NestJS ou Fastify) + TypeScript | Um idioma no projeto todo |
| Banco | PostgreSQL + Prisma | Usuários, simuladores, acessos, compras, comunicados, tickets, depoimentos, FAQ |
| Autenticação | Access token curto + refresh token em cookie httpOnly; 2FA opcional | Evita token guardado no frontend |
| Acesso aos simuladores | URL assinada com expiração por sessão | Mesmo controle observado na referência |
| Tempo real | SSE para sessão e notificações | Simples e suficiente para o caso |
| Pagamentos | Webhooks Hotmart/Eduzz → tabela de acessos | Libera simulador conforme compra |
| Arquivos | Armazenamento S3 compatível | Thumbs, banners, anexos |
| Logs | Logs estruturados + auditoria de acesso a simuladores | Métricas como "acessos" por simulador |

## Simulador de Comandos Elétricos (implementado)
- **Modelo:** `comps[]` (tipo, posição, rotação, tag, propriedades) e `wires[]` (borne A →
  borne B, cor, pontos de dobra).
- **Motor:** a cada evento, une bornes ligados por fios e por contatos fechados (union-find).
  O cálculo se repete até bobinas, fontes e transformadores estabilizarem (selo e intertravamento);
  se não estabilizar em 40 passos, o circuito é marcado como oscilante.
- **Electrical Voltage Engine** (mesmo arquivo, módulos separados):
  - `ProjectElectricalConfig`: rede do projeto (`doc.elec` = tipo, tensão, referência fase-fase ou
    fase-neutro, frequência). Projetos sem `elec` usam o padrão original 220/380 V, 60 Hz.
  - `ElectricalNetwork` / `PhaseResolver`: condutores disponíveis (L1, L2, L3, N, PE) e fasores
    (L1 0°, L2 −120°, L3 +120°). Rede sem neutro não cria N; monofásica não cria L2/L3.
  - `PotentialDifferenceCalculator`: tensão entre dois nós = módulo da diferença vetorial (CA) e da
    parte contínua (CC). Nunca subtrai módulos RMS.
  - Domínios e referências: cada fonte (rede, secundário de transformador, saída de fonte CA/CC) é um
    domínio. Domínios que se tocam por um condutor passam a ter a mesma referência (union-find com
    deslocamento fasorial); potenciais diferentes no mesmo nó são curto-circuito, inclusive entre fontes.
    Domínios sem ligação entre si não têm diferença de potencial (circuito aberto).
  - `TransformerModel`: monofásico, de comando, trifásico (Yy0, Yd11, Dyn11, Dd0) e autotransformador.
    Saída = tensão realmente aplicada × relação nominal, com aviso de primário incompatível. Isolado cria
    um domínio novo; autotransformador fica no domínio da entrada. Sem primário, não há secundário; CC
    no primário não induz tensão.
  - `PowerSupplyModel`: fonte CA/CC 12/24/48 VCC com faixa de entrada; fora da faixa entra em proteção.
  - `ComponentVoltageValidator`: bobinas, temporizadores, relés e sinalizadores com tensão nominal,
    tipo CA/CC/CA-CC, frequência e faixa (padrão 85–110 % para bobinas, 90–110 % para sinalizadores).
    Sobretensão aciona com alerta, subtensão não aciona, CA/CC incompatível não aciona, PE como retorno
    não aciona. Componentes sem tensão nominal (projetos antigos) seguem o modelo simplificado original.
  - `ElectricalDiagnostics` / `ElectricalDomainManager`: atenções exibidas no painel, na barra de status
    e no monitoramento, com a origem e o nível de cada domínio.
- **Temporizadores:** acumulam o tempo enquanto energizados e reiniciam ao desenergizar (TON).

## Laboratório prático (Interactive HMI & Practical Exercise Engine)
- `ApplicationRegistry` / `ExampleLibraryRegistry` / `ExerciseLibraryRegistry`: uma configuração por aplicação
  (applicationId, title, description, sceneTemplate, devices, bindings, initialConditions, physicalParameters,
  demonstrationSequence, exampleProjectReference, exerciseRequirements, testScenarios, difficulty, electricalConfig).
  Nova aplicação = novo registro; carrossel, bibliotecas e motor elétrico não mudam.
- `TagBindingManager`: componente → dispositivo por `c.dev` (estável) ou pela TAG compatível; valida o tipo.
- `VirtualActuatorEngine` lê as saídas reais (motores, bobinas, temporizadores, sinalizadores); `HMIBindingEngine` envia
  comandos da IHM; `VirtualProcessEngine` (`PROCESS[template]`) calcula a física; `VirtualSensorEngine` devolve os
  sensores ao motor elétrico. Tudo roda em `simStep(dt)`, o mesmo passo dos temporizadores.
- `HMISceneRenderer` (`SCENES`): cenas SVG por template (water, gate, traffic, flipflop, stardelta, emergency, timers),
  compartilhadas pela demonstração, pela IHM e pelo Exercise Lab.
- `DemoRunner`: sequência de referência isolada (não usa o projeto nem a simulação).
- `ExerciseSession`, `ExerciseTestRunner` (cenários sem interface, circuito real + processo, estado restaurado),
  `ExerciseValidationEngine`, `ExerciseProgressManager` (progresso no projeto e no navegador).

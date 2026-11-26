# VoltAcademy

Plataforma educacional de simuladores elétricos. Este repositório começa pelo **Simulador de
Comandos Elétricos**, que já funciona de ponta a ponta.

## Ver o programa rodando

- **Sem instalar nada:** abra `dist/VoltAcademy-Comandos-Eletricos.html` com dois cliques
  (Chrome, Edge ou Firefox). No Windows, também dá para usar `INICIAR-SIMULADOR.bat`.
- **Online:** a mesma página está publicada no Claude (link privado do dono da conta).

Ao abrir, o circuito "Partida direta com selo" já vem carregado. Aperte **SIMULAR**, segure
**S1** para ligar o contator K1 e segure **S0** para desligar.

## Interface
- **Barra superior em três regiões:** à esquerda o logo e o nome do projeto; no centro (centralizado na largura da tela)
  Simular, cronômetro, Desfazer, Refazer, Projeto, Ajuda, Som e Tema; à direita só o botão **Painel**.
- **Painel do projeto (Project Manager):** abre pela direita (340 px) e fecha no mesmo botão, no X ou com Esc; fechado não
  ocupa espaço e a folha volta a crescer sem mudar zoom, posição, componentes ou fios. Aba **Projeto**: 01 Visualização
  (Símbolos/2D), 02 Folhas do projeto (tabela com nº, nome, componentes, formato e folha ativa acesa), 03 + Nova folha (pede o
  nome e seleciona a folha criada), 04 Gerenciar folha (Configurar, Renomear, Apagar com confirmação e lista das ligações com
  outras folhas) e 05 Dados elétricos do projeto. Aba **Propriedades**: componente ou fio selecionado, avisos e atenções.
  No canto da folha um indicador discreto mostra a folha ativa ("Folha 02 — Comando") e abre o painel.
- **Biblioteca retrátil (esquerda):** só as categorias ficam fixas (Alimentação, Comando, Contatores e relés, Proteção,
  Cargas). Clicar abre um painel deslizante com os componentes daquela categoria em lista de uma coluna (ícone + nome) e busca; clicar de novo fecha. O painel
  flutua sobre a folha, então o desenho não muda de tamanho, zoom nem posição. Componentes entram por clique ou arrastando
  até a folha.
- **Active Energy UI:** o elemento ativo de cada grupo (categoria, folha, ferramenta, modo, navegação, painel, simulação)
  ganha luz amarela viva (#FFD600) com brilho que respira, reflexo de energia e LED indicador, sem trocar as cores
  originais. Classes reutilizáveis `.energy-active`, `.energy-hover`, `.energy-indicator`, `.energy-flow`, `.energy-pulse`;
  respeita "reduzir movimento" do sistema.
- **Folhas:** gerenciadas no Painel do projeto. A simulação roda em todas as folhas juntas.
  Segmentos de cabo OUT/IN e setas com a mesma tag ligam folhas diferentes e mostram o destino ("→ 2.3" = folha 2, coluna 3).
  Abaixo de cada bobina aparece onde estão seus contatos (espelho de contatos).
- **Modo foco no Diagrama:** ao entrar no Diagrama, a navegação inferior aparece e se recolhe sozinha após 3 s,
  liberando a altura para a folha (zoom, posição, componentes e fios não mudam). A seta amarela centralizada na barra de
  status abre e fecha a navegação; abrir manualmente cancela o recolhimento automático. A barra de status (modo, avisos,
  atenções, tensão, corrente, frequência e estado) fica sempre visível.
- **Ferramentas (direita):** selecionar, fio, mover tela, cor do fio, girar, excluir, zoom e enquadrar.
- **Navegação (inferior):** Diagrama · Operação / HMI (ambiente animado da aplicação ou painel com botões grandes) · Início (projetos e exemplos) ·
  Tags (lista de componentes com folha, bornes e estado) · Monitoramento (estados ao vivo e registro de eventos).
- Durante a simulação, os fios por onde passa corrente ficam animados.
- **Aparência Símbolos ou 2D:** no modo 2D cada componente vira um desenho de equipamento real (disjuntor com alavanca,
  disjuntor-motor com manopla, contator com visor I/O, relé térmico com dial e reset, botões coloridos, sinaleiros acesos,
  sensores, fusíveis com visor e motor com ventoinha girando). Desenhos vetoriais próprios, sem fotos de fabricantes.
- **Fios:** aperte num borne e arraste até outro. Os bornes viram alvos verdes, o fio gruda no mais próximo e nasce com
  rota automática em ângulo reto que desvia dos componentes (com animação de desenho). Clique no fio e arraste as alças
  para reposicionar os trechos. Cada fio recebe número automático; o duplo clique abre o editor de número, cor, tipo de
  circuito (comando ou potência) e seção do cabo (comando 0,75–4 mm², potência 0,75–25 mm²). A espessura no desenho não muda.
- **Números de fio por ponto elétrico:** fios ligados ao mesmo ponto (inclusive pela continuação em outra folha) mantêm o
  mesmo número; só um ponto diferente recebe número novo. Mudar o número de um fio muda o ponto inteiro.
- **Configurar folha:** tamanho A4 a A0, paisagem ou retrato, colunas e linhas da grade, título, descrição, autor, projeto,
  data automática ou manual e logo da empresa no carimbo (opção de aplicar a todas as folhas).
- **Arquivos (botão Projeto):** salvar o projeto em `.voltacademy` para backup (Ctrl+S; no Chrome/Edge escolhe a pasta),
  abrir um arquivo ou adicionar as folhas dele ao projeto atual (também arrastando o arquivo para a janela) e exportar
  **PDF** sem internet e sem janela de impressão (Ctrl+P): uma página por folha no tamanho configurado, aparência símbolos
  ou 2D, qualidade ajustável e relatório de cabos e componentes. Na página publicada no Claude cada download pede confirmação e
  o projeto sai como `.voltacademy.json`.
- **Aba Listas:** resumo de cabos por bitola e cor, lista de fios (de/para), lista de componentes, renumeração e cópia em CSV.
- **Sinalização sonora:** buzzer, buzina e sirene com som real na simulação (contínuo, intermitente, pulsado, bitonal e
  varredura), botão para ouvir no painel de propriedades e botão Som/Mudo na barra superior.
- **Configurar novo projeto:** em Início › Novo projeto › Criar projeto abre a mesma janela de Configurar folha (logo,
  tamanho, orientação, grade, título, descrição, autor, projeto, data) com a **Configuração elétrica do projeto**:
  127, 220, 380 ou 440 VCA, rede monofásica, entre duas fases, trifásica sem neutro ou com neutro, 50/60 Hz e se a tensão
  informada é fase-fase ou fase-neutro, com prévia das tensões. Pular configuração usa os padrões; Fechar cancela sem mexer
  no projeto atual. A rede também pode ser alterada depois em Configurar folha.
- **Motor de tensão (Electrical Voltage Engine):** tensões por fasores. Em 220/380 V, L1–N ≈ 220 V e L1–L2 = 380 V; em
  254/440 V, L1–N ≈ 254 V (nunca 220 V sem transformador); em 127/220 V, L1–L2 = 220 V. Rede sem neutro não cria N e
  rede monofásica não cria L2/L3. Bobinas, temporizadores, relés e sinalizadores têm tensão nominal, tipo CA/CC,
  frequência e faixa de operação: sobretensão, subtensão, CA/CC incompatível, frequência diferente, neutro ou fase
  indisponível, PE como retorno, primário incompatível e curto entre fontes geram atenções explicativas. Projetos antigos,
  sem tensão nominal nos componentes, mantêm o comportamento original.
- **Transformadores:** monofásico, de comando, trifásico (Yy0, Yd11, Dyn11, Dd0, com ou sem neutro no secundário) e
  autotransformador de tensão, com presets 220/127, 220/24, 380/220, 380/127, 380/24, 440/380, 440/220, 440/127, 440/24 ou
  valores livres. O secundário depende da tensão aplicada ao primário (440/220 V alimentado com 380 V entrega 190 V e avisa).
  Transformador isolado cria um novo domínio elétrico; autotransformador não isola.
- **Fonte CA/CC configurável:** 12, 24 ou 48 VCC, corrente nominal e faixa de entrada.
- **Grandezas elétricas:** barra inferior com a rede nominal do projeto, a tensão efetiva no componente selecionado,
  tensão, corrente total, frequência e estado. O monitoramento lista os domínios de alimentação (rede, secundários e
  fontes) com origem, nível, isolamento e estado.
- **Monitoramento com gráficos** de corrente dos motores (pico de partida, regime, sobrecarga) e tensão da rede (afundamento no curto),
  com cruz de leitura ao passar o mouse e marcação das falhas.
- **Simulação de falhas:** curto entre fases no motor, curto na bobina ou no sinaleiro, sobrecarga do motor e abertura de fusível.
  A proteção que está no caminho da corrente de curto atua sozinha (fusível queima, disjuntor desarma) e o relé térmico dispara
  por sobrecarga ou falta de fase, tudo com animação de falha. "Rearmar proteções" volta ao normal.

## Tela inicial e Project Lab (holográficos)
- **VOLT CORE:** reator de energia em 3D no estilo "sol de plasma": esfera com granulação e filamentos procedurais,
  coroa e lens flare, anéis giroscópicos dourados com contas de luz, câmara com luz azul ao fundo, partículas, arcos de
  energia e varredura, com máquina de estados IDLE · SELECT · MATERIALIZE · PREVIEW · LOADING · SUCCESS.
- **Carrossel em órbita:** as operações Novo projeto, Continuar projeto, Abrir arquivo e Exemplos ficam em uma órbita
  de 360° (espaçamento calculado pela quantidade, hoje 90°), cada uma com seu objeto holográfico de vidro dourado animado (prancheta, painéis com o circuito salvo, pasta de vidro
  que abre com páginas subindo e painéis de exemplos em leque), sobre fundo com bokeh. Navegação por
  clique, arraste, setas, roda do mouse e Enter. As operações ficam centralizadas em `HOME_OPS` (id, título, descrição,
  objeto, ação): incluir uma nova não exige mexer no carrossel.
- **Holographic Project Lab:** lista lateral dos exemplos (mesma fonte `EXAMPLES`), projeção 3D construída a partir dos
  dados reais do circuito (símbolos IEC, condutores, bornes e tags) com materialização em etapas, rotação automática e
  manual, zoom, mover, centralizar e troca de folha; modo Multifilar 2D com a folha técnica original; painel com
  objetivo didático, testes e funcionamento esperado; botão ABRIR PROJETO NO SIMULADOR.
- Os modos Unifilar, Componentes 3D, Aplicação industrial 3D e Vista explodida aparecem indisponíveis até existirem dados
  reais: um unifilar cadastrado no exemplo ou modelos GLB/GLTF em `MODEL_REGISTRY`. Nada é gerado ou simulado como
  substituto.
- Motor 3D próprio em Canvas (sem bibliotecas externas, funciona offline), qualidade adaptativa pelo tempo de quadro,
  pausa quando a tela não está visível e suporte a "reduzir movimento".

## Laboratório prático: exemplos, exercícios e IHM
- **Carrossel com 5 operações (72°):** Novo projeto, Continuar projeto, Abrir projeto, Exemplos de projeto e
  **Exercícios** (prancheta holográfica com checklist).
- **7 famílias, 11 aplicações:** emergência e rearme; temporizadores (TON, TOF, pulso, cíclico, alarme temporizado);
  partida estrela-triângulo; flip-flop; semáforo; caixa d’água automática; portão deslizante. Cada aplicação tem uma
  configuração única (`ApplicationRegistry`): dispositivos e TAGs, template de IHM, condições iniciais, parâmetros
  físicos, demonstração, exemplo resolvido, requisitos, cenários de teste, nível e rede elétrica.
- **Exemplos resolvidos** entram no Holographic Project Lab (agora com 15 projetos) com categoria, nível, template de IHM e
  TAGs. Abrir carrega o diagrama completo e a aplicação animada em Operação / HMI.
- **Practical Exercise Lab:** lista de exercícios com nível e progresso, demonstração animada do comportamento esperado
  (**DEMONSTRATION MODE**, sequência de referência que não executa nem altera o circuito do aluno), objetivo, requisitos,
  TAGs, dispositivos e critérios. **Iniciar exercício** cria uma sessão nova com a rede prevista e as folhas em branco;
  **Continuar** retoma a sessão salva.
- **Operação / HMI:** com aplicação associada, mostra o ambiente animado (**SIMULAÇÃO AO VIVO**, saídas reais do circuito),
  comandos da IHM, condições do processo (consumo, falta de água, falha da bomba, sobrecarga, obstáculo), TAGs com estado,
  informações elétricas, diagnósticos e requisitos. Sem aplicação, continua o painel genérico.
- **Motor de processo virtual:** o motor elétrico aciona os atuadores; o processo calcula a física (nível, posição do portão,
  velocidade) e devolve os sensores (boias, fins de curso, fotocélula) ao motor elétrico, no mesmo passo de tempo dos
  temporizadores. Nada é corrigido na animação: circuito errado mostra a consequência (transbordamento, comando após o fim
  de curso, conflito estrela/triângulo) e gera diagnóstico.
- **Validação funcional:** cada exercício tem cenários com condição inicial, eventos, estado esperado e tempo limite,
  executados no circuito real do aluno sem alterá-lo. Resultados: não testado, em execução, aprovado, reprovado, não
  aplicável ou inconclusivo, com mensagem por requisito e dicas progressivas. Qualquer solução elétrica que cumpra os
  requisitos é aceita. Progresso salvo no arquivo do projeto e no navegador.
- **TAGs:** cada componente pode ser associado a um dispositivo da aplicação (identificador estável, compatibilidade de tipo,
  vários contatos por dispositivo). Novos componentes IEC: chave de nível (boia) NA/NF, fim de curso NA/NF, fotocélula NA/NF
  e bobina temporizada com retardo na desenergização.
- Modelos educacionais: portão e emergência não são sistemas de segurança certificados; velocidade e corrente do
  estrela-triângulo são estimadas.

## O que o simulador faz
- **Biblioteca IEC 60617 com 57 componentes**, desenhados na posição de repouso:
  - Alimentação: fase (L1/L2/L3), neutro, fonte trifásica + N + PE, fonte CA/CC configurável (12/24/48 VCC), transformadores monofásico, de comando e trifásico, autotransformador de tensão,
    autotransformador de partida, setas de continuação, segmentos de cabo IN/OUT, ponto de conexão.
  - Comando: botões NA/NF, pulsador NA+NF, pulsador comutador, emergência NA/NF (cogumelo com
    trava), chaves seletoras NA/NF, sensores indutivos (Fe) e capacitivos NA/NF.
  - Contatores e relés: bobina, bobina temporizada, contatos auxiliares NA/NF/comutador,
    contatos temporizados NA/NF, contator de força 3 polos, relé de segurança, relé de falta de fase.
  - Proteção: disjuntores mono, bi, tripolar e disjuntor-motor, fusível, conjunto de fusíveis,
    relé térmico de força e seus contatos 95-96 / 97-98.
  - Cargas e sinalização: sinaleiro com cor, buzzer, buzina, sirene, motor trifásico e motor de 6 pontas.
- Bornes numerados conforme a norma (13-14, 21-22, 95-96, A1-A2, 1/3/5–2/4/6, U-V-W…).
- Fios em 8 cores, com rota automática ou pontos de dobra; folha técnica com régua 1–12 / A–F e carimbo.
- **Simulação elétrica:**
  - comando: selo, intertravamento, temporizador com contagem, relé térmico e sinalização;
  - força: fases L1/L2/L3 independentes, sentido de giro do motor, inversão ao trocar duas fases e
    detecção de falta de fase;
  - motor de 6 pontas: reconhece ligação estrela ou triângulo;
  - relé de falta de fase, relé de segurança com rearme, fonte de 24 Vcc;
  - **curto-circuito** entre quaisquer potenciais diferentes (fase-neutro, fase-fase, +24/0 V).
- Avisos de projeto: contato sem bobina com a mesma tag, segmento de cabo sem par, componente sem ligação.
- Desfazer/refazer, zoom (roda do mouse ou pinça no celular), salvamento automático e exportação/importação em JSON.
- 4 circuitos de exemplo: partida direta, força e comando em 2 folhas, reversão com
  intertravamento e partida com sinalização temporizada.

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

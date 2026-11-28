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
- **Seleção estilo CAD:** clique seleciona; Ctrl+clique soma ou remove; Shift+clique soma; Ctrl+A seleciona a folha; Esc
  limpa. Arrastar no fundo desenha a janela de seleção: da esquerda para a direita pega só os componentes inteiros dentro
  (azul), da direita para a esquerda pega os que cruzam (verde). Arrastar um selecionado move o grupo inteiro com os fios;
  Del exclui (pede confirmação a partir de 6), Ctrl+C/Ctrl+V copia e cola, Ctrl+D duplica (novas TAGs para dispositivos,
  contatos acompanham a bobina copiada), R gira. A folha é deslocada pela ferramenta Mover tela ou pelo botão do meio.
- **Abas de folhas** no topo do diagrama (número, nome, quantidade de componentes e aviso), sempre visíveis; criar, renomear,
  configurar, duplicar e excluir ficam no Painel do projeto.
- **Barra superior contextual** (configuração única `TOPBAR`): Diagrama mostra tudo; Operação / HMI só Simular, Ajuda e Tema;
  Início e Listas mostram Projeto, Ajuda, Som e Tema; Monitoramento mostra Simular, Projeto, Ajuda, Som e Tema.
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

## Tela inicial e Project Lab
- **Editor CAD:** clique simples só seleciona; **duplo clique** (mesmo componente, < 300 ms) abre Propriedades; o botão
  Painel continua abrindo manualmente. **Inserção contínua**: escolha um item da biblioteca e cada clique na folha insere
  uma nova instância (TAG própria, desfazer por inserção) com prévia semitransparente; botão direito, Esc, novo clique no
  item ou fechar a categoria encerram. **Guias inteligentes** azuis indicam alinhamento de centros (mesmo X/Y) ao inserir
  ou mover, sem deslocar nada e sem entrar no PDF.
- **Conexões inteligentes:** **W** fio individual · **Shift+W** barramento (arraste em linha reta sobre os bornes ou
  clique um a um e Enter: todos ficam na mesma rede, com pontos de conexão reais em cada derivação, e excluir um ramo só
  desliga aquele borne) · **Alt+W** conexão por alinhamento (prévia tracejada verde/âmbar/vermelha e confirmação explícita;
  tripolares ligam 2→1, 4→3, 6→5; curto entre potenciais conhecidos, polos incompatíveis, bornes ocupados e rotas que
  atravessam componentes são bloqueados com motivo) · botão **Auto-conexão** (desligado por padrão). Cada operação é um
  único desfazer; Esc/botão direito cancelam sem fios parciais.
- **Ajuda e vista 3D (V4):** a faixa fixa de instruções saiu da prancheta; o botão **?** na barra de ferramentas abre a
  ajuda e os atalhos da ferramenta ativa. O botão **3D** abre a vista de inspeção: arrastar orbita (inclinação limitada),
  botão do meio move, roda aproxima, **Frontal** reseta e **Vista 2D**/Esc volta à edição com zoom, pan e geometria intactos.
  A vista 3D usa a mesma marcação do diagrama em camadas com relevo e sombra, mostra os estados da simulação e nunca entra
  no PDF. Capa: logo grande (até 68% × 40% da área útil, proporcional) ou VoltAcademy, e o título do projeto maior.
- **Bobina: contator ou relé:** nas Propriedades da bobina, tipo (contator de potência, relé de interface tipo borne,
  relé convencional genérico) → origem (referência verificada, família do fabricante com dados pendentes ou genérico) →
  fabricante → família → bobina CA/CC → corrente dos contatos. Catálogo com 10 fabricantes de contatores, 10 de relés
  tipo borne e 7 referências verificadas; sem combinações inventadas. A bobina escolhida define a tensão nominal usada
  pelo motor elétrico; fios e contatos nunca mudam sozinhos (trocar o tipo avisa antes).
- **Documentação sempre sincronizada:** Listas mostra a prévia da capa, o índice do PDF com páginas reais e a lista de
  materiais (dispositivos físicos: bobina e contatos do mesmo dispositivo contam uma vez), tudo derivado da revisão atual.
  O PDF completo (sempre com capa, índice, folhas, lista de materiais e relatório de conexões) usa um formato único para
  todas as páginas (configurável no projeto; folhas de outro tamanho são reduzidas sem recorte), capa limpa (logo
  proporcional + nome do projeto), índice com autor, empresa, descrição, data, revisão, folhas e páginas reais, tabelas
  com quebra de linha e cabeçalho repetido, e relatório por redes/ligações/terminações — sem metragem inferida do desenho.
- **Sessão e VOLT CORE global:** a aplicação abre **sem projeto ativo** (o último projeto salvo fica só como referência
  em *Continuar projeto*, que fica indisponível se não houver nada salvo). O projeto só é ativado ao concluir Novo,
  Continuar, Abrir, um Exemplo ou um Exercício; falhas de carregamento não ativam nem sobrescrevem o salvo. Sem projeto,
  o Diagrama mostra uma prancheta de espera com as ferramentas bloqueadas, a Operação/IHM mostra o VOLT CORE em espera e
  Listas/Monitoramento mostram estados vazios. O fundo (WebGL + rede neural) é uma camada única compartilhada por trás do
  cabeçalho e das telas, com intensidade por tela, e o núcleo reflete estados reais: STANDBY, INITIALIZING, READY,
  SIMULATING, WARNING, FAULT e SUCCESS.
- **Tela inicial JARVIS ORBITAL:** núcleo central em WebGL2 (adaptado do modelo de reator enviado: esfera de partículas
  dourada, filamentos, três anéis graduados amarelo/azul/dourado, pulsação luminosa, bloom e fundo azul-marinho), sem voz
  nem som. Ao redor, cinco módulos em órbita com perspectiva: **Abrir projeto, Continuar projeto, Novo projeto, Exemplos e
  Exercícios**, usando os ícones originais enviados (pasta aberta, pasta com relógio, pasta com +, livro, capelo), sem cartões
  nem molduras — apenas o objeto, uma luz de pedestal e o rótulo.
  A frente fica maior e com luz amarela; laterais médios; fundo menores e mais escuros. Navegação por clique, setas, arraste,
  roda do mouse e teclado; clicar no módulo da frente executa a função. Abaixo: nome, descrição, contagem e botão principal.
  **Composição:** o núcleo é o protagonista (maior), os módulos são satélites menores e sutis, e o título é discreto.
  **Rede neural de energia (`JarvisNet`):** nós e ligações espalhados pela tela, pulsos que partem do núcleo, ondas a cada
  seleção e linhas de energia do núcleo até cada satélite (dourada no selecionado).
  **Animação hero (`JarvisFX`: iniciar, pausar, encerrar, reiniciar):** uma única camada desacoplada da órbita. Quando o
  módulo chega à frente, o ícone orbital se dissolve e o objeto reconstruído em camadas vetoriais assume o lugar e anima —
  sem imagem fixa com animação por cima. Abrir (pasta abre, folhas sobem ao núcleo por trilhas de dados, anel de carga),
  Continuar (relógio vem à frente, ponteiros voltam e retomam até a hora atual, linha do tempo e partículas), Novo (o “+”
  vira a prancha: grade, linhas técnicas e símbolos; destaca CRIAR PROJETO sem criar nada), Exemplos (livro abre, páginas
  viram, circuito e holograma com corrente) e Exercícios (capelo gira, borla balança, fórmulas, cálculo e esquema prático).
  Nome, descrição e botão entram em sequência depois da animação. Só uma animação por vez; a interação nunca é bloqueada.
  Qualidade automática pelo tempo de quadro, pausa fora da tela, respeito a "reduzir movimento" e alternativa em Canvas 2D
  quando o navegador não tem WebGL2.
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
  partida estrela-triângulo; flip-flop; semáforo (Liga, Desliga, emergência e seletora Manual/Automático com amarelo intermitente); caixa d’água automática; portão deslizante. Cada aplicação tem uma
  configuração única (`ApplicationRegistry`): dispositivos e TAGs, template de IHM, condições iniciais, parâmetros
  físicos, demonstração, exemplo resolvido, requisitos, cenários de teste, nível e rede elétrica.
- **Exemplos resolvidos** entram no Holographic Project Lab (agora com 15 projetos) com categoria, nível, template de IHM e
  TAGs. Abrir carrega o diagrama completo e a aplicação animada em Operação / HMI.
- **Practical Exercise Lab:** lista de exercícios com nível e progresso, demonstração animada do comportamento esperado
  (**DEMONSTRATION MODE**, sequência de referência que não executa nem altera o circuito do aluno), objetivo, requisitos,
  TAGs, dispositivos e critérios. **Iniciar exercício** cria uma sessão nova com a rede prevista e as folhas em branco;
  **Continuar** retoma a sessão salva.
- **Operação / HMI com entradas e saídas:** comandos com o desenho do dispositivo (botoeira NA verde, NF vermelha, emergência
  com retenção, seletora de duas posições), sensores com modo automático, forçamento didático (0/1, marcado em roxo) e falha
  (sem sinal), saídas reais do circuito (contatores, relés, motores, temporizadores, lâmpadas, alarmes), estado do processo,
  diagnósticos e alarmes, falhas simuladas (lâmpada queimada, contato colado, falhas da aplicação) e **modo de teste** com
  roteiros que acionam as entradas da IHM ao vivo. A IHM nunca liga saídas sozinha: quem decide é o circuito.
- **Efeitos sonoros** sintetizados (sem arquivos): clique de botoeira, acionamento de contator e relé, motor partindo, girando
  e parando, água circulando e transbordando, comutação do semáforo, alarme, curto-circuito e falha mecânica. Tocam só em
  eventos reais da simulação, nunca em repetição; volume e liga/desliga no Painel do projeto e na IHM; o botão Som silencia tudo.
- **Falhas visíveis:** transbordamento com água sobre a borda e poça, nível crítico, bomba sem vazão, portão com colisão,
  comandos conflitantes, motor travado e fins de curso desrespeitados, semáforo com sequência incorreta, cores conflitantes e
  lâmpada queimada, e faixa de curto-circuito/proteção atuada/falta de fase/sem alimentação vinda do motor elétrico.
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

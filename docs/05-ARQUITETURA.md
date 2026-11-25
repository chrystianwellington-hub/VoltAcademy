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
  Uma carga (bobina, temporizador, sinaleiro) fica energizada quando um borne está no mesmo nó
  da fase e o outro no do neutro. O cálculo se repete até as bobinas estabilizarem (selo e
  intertravamento); se não estabilizar em 40 passos, o circuito é marcado como oscilante. Fase
  e neutro no mesmo nó indicam curto-circuito.
- **Temporizadores:** acumulam o tempo enquanto energizados e reiniciam ao desenergizar (TON).

# MovenCar — Progresso de Desenvolvimento

Última atualização: 07/08/2026

## Módulo Histórico do Veículo concluído

- `VehicleHistoryEvent` implementado como linha do tempo imutável, com tipos controlados, origem do evento, autoria, filial opcional, data, descrição, quilometragem e metadata interna.
- Migration `20260807190000_add_vehicle_history` cria FKs compostas tenant-safe para veículo, filial e usuário; o banco impede associações entre empresas diferentes.
- API disponível em `GET/POST /api/vehicles/:vehicleId/history` e `GET /api/vehicles/:vehicleId/history/:eventId`, sempre usando `companyId` autenticado e `vehicleId`, com filtros por tipo/período, ordenação e paginação máxima de 100.
- Eventos manuais aceitam somente `NOTE`, `MILEAGE_RECORDED`, `OWNER_CHANGED` e `GENERAL`; empresa, usuário e origem são derivados pelo backend. O payload de resposta omite `companyId` e `metadata`.
- Cadastro e atualização de veículos geram eventos automáticos transacionais. A quilometragem atual só aumenta: um evento histórico menor é preservado sem reduzir o veículo, e atualização direta regressiva é rejeitada.
- Permissões `vehicle_history.view` e `vehicle_history.create` adicionadas ao seed e aplicadas às rotas. Criações manuais geram `AuditLog`.
- Frontend integrado em `/veiculos/:id/historico`, com resumo do veículo, filtros, timeline responsiva e inclusão de anotação, preservando o design system e o modo mock.
- Testes cobrem validação, permissões, isolamento Empresa A x Empresa B, filial cross-tenant, autoria derivada da sessão, filtros, ordenação, paginação, resposta pública e regras de quilometragem.

Arquivos centrais: `backend/src/modules/vehicle-history/*`, `backend/prisma/migrations/20260807190000_add_vehicle_history`, `backend/tests/vehicle-history*`, `src/services/vehicleHistory.ts` e `src/pages/VehicleHistoryPage.tsx`.

Próxima ação: abrir Pull Request de `feature/vehicle-history` para `develop`. Nenhum módulo posterior foi iniciado nesta branch.

## Módulo Veículos concluído

### Auditoria de segurança do Pull Request #3

Revisão pré-merge concluída em 07/08/2026, sem realizar merge. A estrutura do módulo foi confirmada como tenant-safe: FKs compostas protegem cliente e filial no PostgreSQL, todas as operações usam `companyId` autenticado, updates e soft delete usam filtros compostos, e respostas omitem campos internos. Não foi necessária migration adicional.

Foi identificada uma lacuna de cobertura de baixa gravidade: os testes Empresa A x Empresa B existiam no modelo em memória, mas não inspecionavam diretamente as queries Prisma de listagem/leitura e do filtro `customerId`; o frontend também cobria o modo mock, mas não verificava explicitamente o roteamento no modo API real. Foram adicionados testes de regressão para esses pontos, inclusive garantindo que o frontend não envie `companyId` nem IDs demonstrativos de filial.

Resultado final da auditoria: backend com 68 testes e frontend com 13 testes; Prisma validate, migration status, lint e builds aprovados.

- Model `Vehicle` criado com status, cliente obrigatório, filial de origem opcional, placa, RENAVAM, chassi, identificação técnica, anos, combustível, transmissão, potência, portas, quilometragem atual, observações e soft delete.
- A placa é armazenada somente na forma normalizada, evitando duplicidade entre `plate` e `plateNormalized`. São aceitos os formatos brasileiro antigo e Mercosul; veículo sem placa é permitido.
- Migration `20260807170000_add_vehicles` versionada, revisada e aplicada. Inclui FKs compostas tenant-safe para `Customer` e `Branch`, constraints numéricas, índices de listagem e índices parciais de unicidade para placa e chassi ativos por empresa.
- API REST disponível em `GET/POST /api/vehicles` e `GET/PATCH/DELETE /api/vehicles/:id`, com paginação máxima de 100, ordenação, filtros e busca por placa, identificação do veículo, chassi, RENAVAM e cliente.
- Todas as queries usam `companyId` derivado da sessão; cliente deve estar ativo e pertencer à empresa, filial deve estar ativa e pertencer ao mesmo tenant, e IDs cruzados retornam 404.
- Soft delete define `deletedAt` e status `INACTIVE`; placa e chassi podem ser reutilizados após exclusão lógica.
- Permissões `vehicles.view`, `vehicles.create`, `vehicles.update` e `vehicles.delete` aplicadas às rotas e adicionadas ao seed.
- Auditoria transacional implementada com `VEHICLE_CREATE`, `VEHICLE_UPDATE` e `VEHICLE_DELETE`.
- Página Veículos integrada após validação do backend, preservando layout/design system, com busca, filtros, tabela, paginação, seleção de cliente, cadastro e exclusão. `VITE_USE_MOCKS=true` permanece funcional.
- Testes adicionados para validação, normalização, unicidade, soft delete, busca, paginação, permissões, queries tenant-safe e isolamento Empresa A x Empresa B.
- Validação final: backend com 68 testes e frontend com 13 testes; Prisma generate/validate, lint e builds aprovados. Nenhum módulo de histórico, atendimento, OS ou revisão foi iniciado.

Arquivos centrais: `backend/src/modules/vehicles/*`, `backend/prisma/migrations/20260807170000_add_vehicles`, `backend/tests/vehicles*`, `src/services/vehicles.ts` e `src/pages/VehiclesPage.tsx`.

Próxima ação: abrir Pull Request de `feature/vehicles` para `develop`. A próxima etapa funcional permanece pendente e não faz parte desta branch.

## Módulo Clientes concluído

### Auditoria de segurança do Pull Request #2

Revisão pré-merge concluída em 07/08/2026, sem realizar merge. Foram corrigidos:

- atualização de endereço que, após a leitura protegida, ainda executava o `UPDATE` final somente por `id`; agora escrita e releitura exigem `id + companyId + customerId + deletedAt`;
- possibilidade de alterar o tipo do cliente e manter CPF/CNPJ com comprimento incompatível;
- relação de filial de origem reforçada no PostgreSQL por chave estrangeira composta `originBranchId + companyId`, além da validação de filial ativa no serviço;
- regressão do modo demonstrativo: a página Clientes agora respeita `VITE_USE_MOCKS=true` sem chamar uma API autenticada;
- cadastro frontend deixou de enviar os identificadores demonstrativos `matriz`/`norte` como se fossem UUIDs de filial;
- documentação da matriz de permissões atualizada com `customers.*`.

A migration incremental `20260807143000_harden_customer_tenancy` foi aplicada e validada. Foram adicionados testes sobre as queries reais do serviço para isolamento de endereço e transição de documento, além de teste do modo mock no frontend. Resultado da auditoria: backend com 42 testes e frontend com 10 testes; lint e builds aprovados nos dois projetos.

- Schema Prisma auditado com `Customer`, `CustomerAddress`, `CustomerType` e `CustomerStatus`.
- Migration `20260807110000_add_customers` criada, revisada e aplicada com chaves estrangeiras, índices de busca e chave composta de tenant para endereços.
- Documento normalizado para dígitos e único por empresa somente entre registros ativos por índice parcial PostgreSQL, permitindo recadastro após soft delete.
- Índice parcial garante somente um endereço principal ativo por cliente, reforçado por transações na API.
- API REST implementada em `/api/customers`, incluindo CRUD, busca, filtros, ordenação, paginação (máximo 100), endereços e soft delete.
- Todas as consultas de clientes e endereços usam `req.auth.companyId`; filial de origem é validada como ativa e pertencente ao tenant.
- Permissões `customers.view`, `customers.create`, `customers.update` e `customers.delete` adicionadas ao seed e aplicadas às rotas.
- Auditoria transacional adicionada para criação, atualização e exclusão de clientes e endereços.
- Página Clientes conectada à API real com busca, filtros, tabela, paginação, cadastro e exclusão, preservando o design system. Nenhuma dependência de Veículos foi criada.
- Testes específicos cobrem validação, documentos, isolamento Empresa A x Empresa B, permissões, filial, unicidade, soft delete, paginação, busca e endereço principal.
- Validação final: backend com 39 testes; frontend com 9 testes; Prisma generate, lint e builds aprovados.

Arquivos centrais: `backend/src/modules/customers/*`, `backend/prisma/schema.prisma`, migration `add_customers`, `backend/prisma/seed.ts`, `src/pages/CustomersPage.tsx` e `src/services/customers.ts`.

Próxima etapa planejada: abrir Pull Request de `feature/customers` para `develop`. Veículos permanece pendente para uma etapa própria.

## Objetivo do projeto

MovenCar é um SaaS multiempresa para gestão completa de oficinas mecânicas, com isolamento rigoroso de dados por empresa e filial.

Fluxo principal planejado:

Cliente → Veículo → Atendimento → Check-in → Checklist → Orçamento → Aprovação → Ordem de Serviço → Estoque/Peças → Financeiro → Entrega → Revisão futura → CRM

## Situação atual

### Frontend

- React + TypeScript + Vite + Tailwind CSS.
- Layout visual aprovado no padrão MovenCar.
- Identidade principal: preto, amarelo, roxo e verde-limão.
- Sidebar compacta 220px/72px.
- Header com breadcrumb, oficina, filial, busca global, notificações e usuário.
- Dashboard reorganizado em grade responsiva de 12 colunas.
- Seis KPIs compactos.
- Mini Kanban, agenda, movimentações, estoque baixo e retornos.
- Ordens recentes, gráfico de faturamento, compras e contas a receber.
- Rotas demonstrativas existentes preservadas.

### Backend

- Node.js + TypeScript + Express.
- Prisma ORM + PostgreSQL.
- Estrutura de autenticação.
- Multiempresa preparada com Company e Branch.
- Usuários, papéis e permissões.
- Sessão única por usuário.
- Revogação das sessões anteriores no novo login.
- Refresh token salvo em cookie HttpOnly.
- Refresh token armazenado no banco apenas por hash.
- Access token de curta duração.
- Rate limiting no login/refresh.
- Helmet.
- CORS controlado.
- Logs estruturados com Pino.
- AuditLog.
- Health check em /api/health.
- Middleware authenticate consulta UserSession no banco em toda requisição protegida, permitindo queda imediata da sessão anterior.
- app.set('trust proxy', 1) configurado para operação atrás do Nginx.

### Infraestrutura

- Projeto em /home/leandro/movencar.
- Git configurado.
- Repositório GitHub: Leandro-massinha/movencar.
- Branches principais:
  - main: versão estável.
  - develop: integração de desenvolvimento.
- Fluxo adotado: feature/* → develop → main.
- Backend executado pelo PM2 como movencar-api.
- Porta interna da API: 127.0.0.1:3334.
- PM2 configurado para inicialização automática via systemd.
- Nginx configurado para o domínio movencar.com.br.
- Frontend servido pelo Nginx a partir de /home/leandro/movencar/dist.
- /api proxy para 127.0.0.1:3334.
- HTTPS ativo com Let's Encrypt/Certbot.
- https://movencar.com.br responde HTTP 200.
- https://movencar.com.br/api/health responde HTTP 200.

## Git / histórico relevante

Commit inicial:

- 6525b53 — chore: versão inicial do MovenCar

Ajuste de produção:

- 47fa89d — fix: configura trust proxy para nginx

Pull Request #1:

- feature/backend-foundation → develop
- Fundido com sucesso.

## Regras arquiteturais obrigatórias

### Multiempresa

1. Nunca confiar em companyId vindo do frontend.
2. companyId deve ser obtido da sessão autenticada.
3. Toda consulta de dados empresariais deve filtrar por companyId.
4. branchId deve ser validado contra a empresa autenticada.
5. IDs de outras empresas não podem revelar existência de dados.
6. Testes de isolamento devem existir para cada módulo sensível.

### Sessão única

1. Novo login revoga sessões anteriores do mesmo usuário/empresa.
2. Toda requisição protegida valida sessionId no banco.
3. Sessão revogada retorna 401 SESSION_REVOKED.
4. Frontend deve encerrar autenticação e redirecionar para tela de sessão encerrada.
5. Produção deve usar cookie HttpOnly + Secure + SameSite apropriado.

### Git

Não trabalhar diretamente na main.

Fluxo:

feature/nome-da-funcionalidade → develop → main

Cada módulo novo deve:

1. nascer em uma branch feature/*;
2. passar por lint, testes e build;
3. ser enviado ao GitHub;
4. entrar em develop via Pull Request;
5. só chegar à main depois de validado.

## Pontos de segurança ainda a revisar

Antes do lançamento comercial, revisar:

- unicidade de User por companyId + email;
- garantia de que defaultBranchId pertence à mesma Company;
- unicidade/estratégia de Company.document;
- modelagem de Role global com companyId nulo;
- sessionId em AuditLog;
- separação de SESSION_REVOKED e SESSION_EXPIRED;
- logout quando access token estiver expirado;
- limpeza do cookie ao revogar a própria sessão;
- avaliação de PostgreSQL Row-Level Security;
- tsconfig.build.json para build de produção apenas de src;
- política de backup e restauração;
- testes automáticos de isolamento multiempresa para todos os módulos.

## Direção de desenvolvimento

### Próxima etapa: Clientes + Veículos

Motivo: estes dois cadastros são dependências centrais dos demais módulos.

Sequência prevista:

1. Clientes
2. Veículos
3. Histórico completo do veículo
4. Atendimento e Agenda
5. Check-in, Checklist e Pátio
6. Orçamentos e Aprovações
7. Ordens de Serviço
8. Serviços, Técnicos e Apontamentos
9. Estoque e Compras
10. Inventário de Ferramentas e Manutenção Preventiva
11. Financeiro e Centro de Custos
12. Revisões e Garantias
13. CRM e Comunicação
14. Relatórios e Indicadores
15. Auditoria, segurança avançada e hardening final

## Direção para o Codex quando voltar

O Codex NÃO deve recriar o projeto, trocar o design ou refazer a fundação.

Antes de qualquer alteração, deve ler:

- README.md
- AGENTS.md
- docs/ARCHITECTURE.md
- docs/BACKEND_ARCHITECTURE.md
- docs/MULTI_TENANCY.md
- docs/AUTHENTICATION.md
- docs/SESSION_POLICY.md
- docs/SECURITY.md
- docs/DEVELOPMENT_PROGRESS.md

Regras para o Codex:

1. Preservar tudo que já funciona.
2. Trabalhar a partir de develop.
3. Criar uma branch feature/* para cada módulo.
4. Não alterar a identidade visual aprovada sem solicitação.
5. Não confiar em IDs de empresa enviados pelo frontend.
6. Aplicar tenant filtering em todas as queries.
7. Criar testes de acesso cruzado entre empresas.
8. Rodar lint, testes e build antes de concluir.
9. Atualizar este DEVELOPMENT_PROGRESS.md ao final de cada etapa.
10. Informar arquivos alterados, migrations, endpoints, testes e pendências.

## Próxima tarefa concreta

Criar o módulo funcional de Clientes com arquitetura multiempresa e API real, sem ainda implementar Veículos no mesmo passo.

Critérios iniciais para Clientes:

- schema Prisma;
- migration;
- validação Zod;
- repository/service/controller/routes;
- filtro obrigatório por companyId;
- suporte a filial quando aplicável;
- CRUD seguro;
- soft delete;
- busca e paginação;
- permissions customers.view/create/update/delete;
- AuditLog;
- testes de isolamento Empresa A x Empresa B;
- integração com frontend apenas depois da API estar validada.

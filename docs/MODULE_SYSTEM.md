# Sistema de Módulos

## Registro e contratação

`Module` é o catálogo global estável (`code`, nome, descrição, status e indicador Core). `CompanyModule` é a associação por empresa, com status, ativação, expiração e configuração JSON limitada. Códigos são contratos e não devem ser renomeados após uso.

Estados disponíveis para uma contratação: `ACTIVE`, `INACTIVE`, `SUSPENDED` e `EXPIRED`. Somente módulo e associação ativos, já ativados e não expirados liberam acesso. Desativar preserva a associação e todos os dados do domínio; as FKs usam `RESTRICT`.

## Autorização em duas etapas

1. `requireModule('vehicles')` verifica a contratação usando exclusivamente `req.auth.companyId`.
2. `requirePermission('vehicles.view')` verifica a ação do usuário.

As duas verificações são obrigatórias. O backend é a autoridade. `/auth/me` retorna somente códigos habilitados para UX; o frontend usa esse conjunto no menu e nas rotas, mas isso não substitui o middleware.

## Uso em novas rotas

Cada router comercial deve aplicar, após `authenticate`, um único gate de módulo e depois permissões por endpoint. Regras de datas/status ficam em `modules/platform/module-gate.ts`, não em `if`s locais. Rotas Core (autenticação, sessão e coleta mínima de auditoria) não dependem de assinatura.

## Administração futura

Não foi criada API pública de contratação nesta etapa. Alterações futuras exigirão serviço administrativo isolado, auditoria, filtro pelo tenant-alvo autorizado e idempotência. O frontend comum jamais poderá ativar módulos enviando `companyId`.

## BusinessType

O desenho recomendado é catálogo `BusinessType` + associação `CompanyBusinessType`, pois uma empresa pode ser multisserviço. Tipos orientam presets, módulos sugeridos, templates e dashboards; nunca criam schemas diferentes nem concedem permissão automaticamente. A persistência fica adiada até existir onboarding/configuração funcional.

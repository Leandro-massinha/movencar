# Sistema de Módulos

## Registro e contratação

`Module` é o catálogo global estável (`code`, nome, descrição, status e indicador Core). `CompanyModule` é a associação por empresa, com status, ativação, expiração e configuração JSON limitada. Códigos são contratos e não devem ser renomeados após uso.

Estados disponíveis para uma contratação: `ACTIVE`, `INACTIVE`, `SUSPENDED` e `EXPIRED`. Somente módulo e associação ativos, já ativados e não expirados liberam acesso. Desativar preserva a associação e todos os dados do domínio; as FKs usam `RESTRICT`.

## Autorização em duas etapas

1. `requireModule('vehicles')` verifica a contratação usando exclusivamente `req.auth.companyId`.
2. `requirePermission('vehicles.view')` verifica a ação do usuário.

As duas verificações são obrigatórias. O backend é a autoridade. `/auth/me` retorna somente códigos habilitados para UX; o frontend usa esse conjunto no menu e nas rotas, mas isso não substitui o middleware.

O histórico básico do veículo acompanha o entitlement `vehicles`; `vehicle_history.view` e `vehicle_history.create` continuam permissões granulares, não um produto comercial separado. Assim, `/veiculos/:id/historico` exige módulo Vehicles ativo e a permissão correspondente nos dois lados da aplicação.

## Dependências fundamentais

`vehicles` depende de `customers`. O gate central não libera Vehicles nem o anuncia em `/auth/me` quando Customers está indisponível. Esta dependência curta fica em código versionado porque é estrutural e estável; não foi criado um motor genérico de dependências. Desativação futura de Customers deve ser recusada enquanto Vehicles estiver ativo pela API administrativa, que ainda não existe.

Customer 360° e Vehicle 360° são capacidades dos módulos existentes `customers` e `vehicles`. Propriedade e odômetro acompanham Vehicles e reutilizam suas permissões. Atendimento, relato e Check-in pertencerão a `workshop`, que dependerá de Customers e Vehicles; não será criado um módulo comercial por entidade.

WorkOrder, CustomerConcern e VehicleCheckIn usam o módulo existente `workshop`. PDC e testes de rodagem também pertencerão a Workshop quando implementados. A fundação não cria novos produtos comerciais nem ativa módulos além das associações já existentes.

Workshop depende de Customers e Vehicles no gate central. Se qualquer dependência estiver indisponível, Workshop não é anunciado em `/auth/me` nem libera as rotas de entrada.

## Uso em novas rotas

Cada router comercial deve aplicar, após `authenticate`, um único gate de módulo e depois permissões por endpoint. Regras de datas/status ficam em `modules/platform/module-gate.ts`, não em `if`s locais. Rotas Core (autenticação, sessão e coleta mínima de auditoria) não dependem de assinatura.

## Administração futura

Não foi criada API pública de contratação nesta etapa. Alterações futuras exigirão serviço administrativo isolado, auditoria, filtro pelo tenant-alvo autorizado e idempotência. O frontend comum jamais poderá ativar módulos enviando `companyId`.

## BusinessType

O desenho recomendado é catálogo `BusinessType` + associação `CompanyBusinessType`, pois uma empresa pode ser multisserviço. Tipos orientam presets, módulos sugeridos, templates e dashboards; nunca criam schemas diferentes nem concedem permissão automaticamente. A persistência fica adiada até existir onboarding/configuração funcional.

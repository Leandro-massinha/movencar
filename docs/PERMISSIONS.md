# MOVENCAR - Permissoes

Permissoes sao granulares por modulo: `dashboard.view`, `agenda.view`, `vehicles.view`, `orders.view`, `finance.view`, `crm.view`, `yard.view`, `tools.view` e `settings.manage`.

Clientes utiliza `customers.view`, `customers.create`, `customers.update` e `customers.delete` no frontend e obrigatoriamente nas rotas correspondentes do backend.

Veiculos utiliza `vehicles.view`, `vehicles.create`, `vehicles.update` e `vehicles.delete`. Consultas exigem `vehicles.view`; criacao, alteracao e soft delete exigem suas permissoes especificas.

O frontend oculta navegacao e protege rotas para UX. O backend continua sendo a autoridade e deve validar usuario, tenant, filial, recurso e acao em toda requisicao.

## Modulo versus permissao

Permissao responde "este usuario pode executar a acao?". `CompanyModule` responde "esta empresa contratou e pode usar o dominio?". Endpoints comerciais exigem ambas as respostas positivas: `authenticate` → `requireModule(code)` → `requirePermission(action)`. Uma permissao existente nao contorna modulo inativo, suspenso, expirado ou ainda nao ativado.

Autenticacao, sessoes e coleta minima de AuditLog pertencem ao Core e nao podem ser desligadas comercialmente. Recursos futuros de auditoria avancada podem ser modulares sem interromper a coleta basica.

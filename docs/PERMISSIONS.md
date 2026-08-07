# MOVENCAR - Permissoes

Permissoes sao granulares por modulo: `dashboard.view`, `agenda.view`, `vehicles.view`, `orders.view`, `finance.view`, `crm.view`, `yard.view`, `tools.view` e `settings.manage`.

Clientes utiliza `customers.view`, `customers.create`, `customers.update` e `customers.delete` no frontend e obrigatoriamente nas rotas correspondentes do backend.

Veiculos utiliza `vehicles.view`, `vehicles.create`, `vehicles.update` e `vehicles.delete`. Consultas exigem `vehicles.view`; criacao, alteracao e soft delete exigem suas permissoes especificas.

O frontend oculta navegacao e protege rotas para UX. O backend continua sendo a autoridade e deve validar usuario, tenant, filial, recurso e acao em toda requisicao.

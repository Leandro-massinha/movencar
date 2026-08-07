# MOVENCAR - Permissoes

Permissoes sao granulares por modulo: `dashboard.view`, `agenda.view`, `vehicles.view`, `orders.view`, `finance.view`, `crm.view`, `yard.view`, `tools.view` e `settings.manage`.

Clientes utiliza `customers.view`, `customers.create`, `customers.update` e `customers.delete` no frontend e obrigatoriamente nas rotas correspondentes do backend.

Customer 360 reutiliza essas permissões: profile/contatos/deduplicação exigem `customers.view`; criação de contatos e relacionamentos usa `customers.create`; perfis, preferências, consentimentos e desativação lógica de contato usam `customers.update`. `customers.delete` permanece reservado à exclusão lógica do Customer/endereço. Não existe permissão sensível sem uma política funcional distinta.

Veiculos utiliza `vehicles.view`, `vehicles.create`, `vehicles.update` e `vehicles.delete`. Consultas exigem `vehicles.view`; criacao, alteracao e soft delete exigem suas permissoes especificas.

Historico do veiculo utiliza `vehicle_history.view` para consultar a linha do tempo e `vehicle_history.create` para incluir eventos manuais. Eventos automaticos sao criados internamente nas transacoes do modulo de origem e nao dependem de dados de autoria ou empresa enviados pelo frontend.

O historico basico compartilha o entitlement comercial `vehicles`; ele nao possui `CompanyModule` independente. Portanto, uma chamada de timeline exige Vehicles ativo e a permissao `vehicle_history.*` apropriada.

O frontend oculta navegacao e protege rotas para UX. O backend continua sendo a autoridade e deve validar usuario, tenant, filial, recurso e acao em toda requisicao.

Propriedade e odômetro fazem parte de Vehicles: as consultas usam `vehicles.view` e a troca atual continua protegida por `vehicles.update`. Atendimento presencial, OS, relato e Check-in pertencem ao módulo `workshop`.

A fundação de entrada implementa `work_orders.view`, `work_orders.create`, `work_orders.close`, `customer_concerns.create`, `checkins.view`, `checkins.create`, `checkins.update` e `checkins.complete`, sempre após `requireModule('workshop')`. Não existem ainda `work_orders.update` nem `checkins.confirm`, pois não há operação funcional segura correspondente. PDC e road test permanecem sem permissões até suas APIs existirem.

## Modulo versus permissao

Permissao responde "este usuario pode executar a acao?". `CompanyModule` responde "esta empresa contratou e pode usar o dominio?". Endpoints comerciais exigem ambas as respostas positivas: `authenticate` → `requireModule(code)` → `requirePermission(action)`. Uma permissao existente nao contorna modulo inativo, suspenso, expirado ou ainda nao ativado.

Autenticacao, sessoes e coleta minima de AuditLog pertencem ao Core e nao podem ser desligadas comercialmente. Recursos futuros de auditoria avancada podem ser modulares sem interromper a coleta basica.

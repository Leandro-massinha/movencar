# Deduplicação de Clientes

CPF/CNPJ válido e normalizado é sinal forte e permanece único apenas entre Customers ativos da mesma empresa. Telefone, WhatsApp e e-mail normalizados são sinais secundários: podem ser compartilhados por família ou empresa e, portanto, apenas geram alerta.

`GET /api/customers/possible-duplicates` aceita documento, telefone ou e-mail, sempre filtra pelo tenant autenticado, limita o resultado e mascara evidências. Não há fuzzy matching agressivo nem merge automático.

Merge futuro será uma operação explícita, auditada e transacional, capaz de reatribuir Vehicle, Ownership, WorkOrder e domínios futuros sem apagar históricos. Não foi implementado nesta etapa.

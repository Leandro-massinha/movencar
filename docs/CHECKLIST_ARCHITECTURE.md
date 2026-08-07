# Arquitetura de Listas de Verificação

O MovenCar usa modelos normalizados e versionados: `ChecklistTemplate` possui seções e itens ordenados; `ChecklistInstance` fixa `templateId + templateVersion`; `ChecklistItemResult` preserva uma resposta por item. A ausência de resultado nunca significa `OK`.

O template padrão de Check-in é global, imutável e compartilhado, evitando uma cópia por empresa. Templates futuros específicos carregam `companyId`; o serviço prefere o padrão ativo da empresa e usa o global como fallback. Índices parciais garantem um padrão ativo por tipo/escopo. Empresas não editam o template global.

Respostas suportadas no domínio: `STATUS`, `BOOLEAN`, `TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `MEASUREMENT`, `PHOTO` e `SIGNATURE`. A primeira UI implementa `STATUS`; quilometragem/combustível permanecem nos campos canônicos do Check-in. Os demais tipos estão preparados sem apresentar controles inoperantes.

Estados observacionais são `OK`, `ISSUE`, `NOT_CHECKED` e `NOT_APPLICABLE`. Somente instâncias em rascunho aceitam respostas. A conclusão exige resposta explícita para todos os itens obrigatórios e congela permanentemente a versão utilizada.

O template padrão “Check-in padrão — Oficina geral”, versão 1, é criado idempotentemente pela migration com 9 seções e 56 itens, cobrindo exterior, vidros, pneus, interior, painel, funcionamento básico, itens presentes e observações.

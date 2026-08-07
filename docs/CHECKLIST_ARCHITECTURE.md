# Arquitetura de Listas de Verificação

O MovenCar usa modelos normalizados e versionados: `ChecklistTemplate` possui seções e itens ordenados; `ChecklistInstance` fixa `templateId + templateVersion`; `ChecklistItemResult` preserva uma resposta por item. A ausência de resultado nunca significa `OK`.

O template padrão de Check-in é global, imutável e compartilhado, evitando uma cópia por empresa. Templates futuros específicos carregam `companyId`; o serviço prefere o padrão ativo da empresa e usa o global como fallback. Índices parciais garantem um padrão ativo por tipo/escopo. Empresas não editam o template global. Triggers incrementais impedem alteração, remoção ou ampliação retroativa do conteúdo de qualquer versão já referenciada; flags de ativação podem mudar sem destruir a reprodução histórica.

Respostas suportadas no domínio: `STATUS`, `BOOLEAN`, `TEXT`, `NUMBER`, `SELECT`, `MULTI_SELECT`, `MEASUREMENT`, `PHOTO` e `SIGNATURE`. A primeira UI implementa os tipos efetivamente usados nesta etapa: `STATUS`, `TEXT`, `NUMBER` e `SELECT`; quilometragem/combustível permanecem também nos campos canônicos do Check-in. Banco e aplicação rejeitam valores mistos, item de outro template e opção inexistente.

Estados observacionais são `OK`, `ISSUE`, `NOT_CHECKED` e `NOT_APPLICABLE`. Somente instâncias em rascunho aceitam respostas. A conclusão exige resposta explícita válida para todos os itens obrigatórios e congela permanentemente a versão utilizada. Edição e conclusão bloqueiam a instância no PostgreSQL para não atravessarem uma à outra; entre duas edições válidas do mesmo item em rascunho, prevalece a última transação confirmada.

O template padrão “Check-in padrão — Oficina geral”, versão 1, é criado idempotentemente pela migration com 9 seções e 56 itens, cobrindo exterior, vidros, pneus, interior, painel, funcionamento básico, itens presentes e observações.

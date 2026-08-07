# Arquitetura de Check-in

## Limite do conceito

Check-in é fotografia documental da entrada, não diagnóstico. `CustomerConcern`, `CheckInObservation` e `DiagnosticFinding` são fontes distintas e nunca sobrescrevem umas às outras.

## Agregado planejado

`VehicleCheckIn` pertencerá a ServiceVisit, Vehicle, Company e Branch. Estados: `DRAFT`, `COMPLETED`, `CONFIRMED`, `CANCELLED`. Quilometragem cria `VehicleOdometerReading`; combustível será percentual inteiro de 0 a 100 para precisão e UX por marcadores. Conclusão congela template/versão e resultados. Confirmação guarda nome, instante, versão documental e referência segura à assinatura.

## Checklist configurável

- `ChecklistTemplate`: empresa, tipo, nome, versão, status, padrão e aplicabilidade;
- seções e itens versionados, ordenados e nunca alterados retroativamente após uso;
- instância vinculada ao check-in com snapshot das perguntas relevantes;
- tipos de resposta: `STATUS`, `TEXT`, `NUMBER`, `PHOTO`, `SELECT`, `MULTI_SELECT`, `MEASUREMENT`, `SIGNATURE`;
- status observacionais: `OK`, `ISSUE`, `NOT_CHECKED`, `NOT_APPLICABLE`;
- avarias usam classificação separada (`SCRATCHED`, `DENTED`, `BROKEN`, `CRACKED`, `MISSING`, `WORN`, `DIRTY`, `DAMAGED`, `OTHER`);
- localização/posição estruturada permite mapa visual e pneus sem colunas fixas;
- `requiresPhoto` e `photoRequiredOnIssue` são regras versionadas do item.

## Imutabilidade e retificação

Somente rascunhos são editáveis. Após conclusão, mudanças críticas geram `CheckInAmendment` com campo, valor anterior/novo, motivo, autor e instante. Confirmação não apaga retificações. Operações usam transação, AuditLog no agregado e eventos idempotentes para Vehicle History.

## Segurança e permissões

FKs compostas impedem cruzamento de tenant entre visita, veículo, filial, template e anexos. Permissões planejadas: `checkins.view/create/update/complete/confirm`. Respostas omitem tenant, chaves privadas, checksum e metadata técnica.

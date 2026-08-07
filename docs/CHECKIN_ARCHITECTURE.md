# Arquitetura de Check-in

## Limite do conceito

Check-in é fotografia documental da entrada, não diagnóstico. `CustomerConcern`, `CheckInObservation` e `DiagnosticFinding` são fontes distintas e nunca sobrescrevem umas às outras.

## Agregado funcional

`VehicleCheckIn` pertence a WorkOrder, Vehicle, Customer, Company e Branch por uma FK composta. Estados: `DRAFT`, `COMPLETED`, `CONFIRMED`, `CANCELLED`. APIs criam/editam rascunho, respostas, avarias e concluem. Quilometragem cria `VehicleOdometerReading`; combustível é percentual inteiro de 0 a 100. Conclusão por CAS congela campos, checklist e avarias na mesma transação. Confirmação permanece reservada para snapshot/assinatura.

## Checklist configurável

- `ChecklistTemplate`: global de sistema ou específico da empresa, tipo, nome, versão, atividade e padrão;
- seções e itens versionados, ordenados e nunca alterados retroativamente após uso;
- instância vinculada ao check-in com snapshot das perguntas relevantes;
- tipos de resposta: `STATUS`, `TEXT`, `NUMBER`, `PHOTO`, `SELECT`, `MULTI_SELECT`, `MEASUREMENT`, `SIGNATURE`;
- status observacionais: `OK`, `ISSUE`, `NOT_CHECKED`, `NOT_APPLICABLE`;
- avarias usam classificação separada (`SCRATCHED`, `DENTED`, `BROKEN`, `CRACKED`, `MISSING`, `WORN`, `DIRTY`, `DAMAGED`, `OTHER`);
- localização/posição estruturada permite mapa visual e pneus sem colunas fixas;
- `requiresPhoto` e `photoRequiredOnIssue` são regras versionadas do item.

## Imutabilidade e retificação

Somente rascunhos são editáveis. A conclusão usa compare-and-swap e gera timeline, AuditLog e odômetro na mesma transação. Após conclusão, mudanças críticas futuras exigirão `CheckInAmendment` com campo, valor anterior/novo, motivo, autor e instante. Confirmação não apagará retificações.

## Segurança e permissões

FKs compostas impedem cruzamento de tenant entre visita, veículo, filial, template e anexos. Permissões planejadas: `checkins.view/create/update/complete/confirm`. Respostas omitem tenant, chaves privadas, checksum e metadata técnica.

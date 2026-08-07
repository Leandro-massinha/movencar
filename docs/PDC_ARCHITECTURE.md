# Arquitetura do PDC

PDC significa “Primeiro Diagnóstico do Carro”: avaliação técnica inicial anterior à execução. É diferente de relato do cliente, condição documental do Check-in, teste de rodagem e diagnóstico técnico aprofundado.

## Decisão

Preparar e documentar agora; persistir no próximo fluxo técnico. Categoria, severidade, recomendações e política de conclusão ainda dependem da experiência operacional. Criar tabelas nesta branch congelaria regras especulativas.

O agregado planejado `PdcInspection` pertence a WorkOrder, Vehicle, Branch e técnico, com rascunho e conclusão imutável. `PdcFinding` permite múltiplas constatações com categoria, localização estruturada, status, descrição, severidade, recomendação e atenção imediata. Evidências usarão Attachment central.

Conclusão futura gera `PDC_COMPLETED`, AuditLog e, quando houver quilometragem, `VehicleOdometerReading` com origem própria e identidade idempotente. Recomendação não aprovada permanece vinculada à constatação para uso futuro de orçamento e CRM.

# Arquitetura de Atendimento

## Decisão

`ServiceVisit` será o contexto amplo de uma interação e poderá existir sem veículo presente, por exemplo em ligação ou consulta de preço. WorkOrder é a raiz operacional de toda entrada física. A persistência de ServiceVisit permanece adiada até existir o fluxo de interações; a OS funcional desta etapa não depende de uma tabela redundante.

## Contrato planejado

- tenant e filial derivados da sessão e validados por FKs compostas;
- Customer e Vehicle obrigatoriamente da mesma empresa; a política para veículo sem proprietário presente será explícita;
- vínculo opcional futuro com WorkOrder quando a interação resultar em entrada física;
- estados iniciais recomendados: `OPEN`, `CHECKED_IN`, `UNDER_EVALUATION`, `WAITING_APPROVAL`, `IN_SERVICE`, `READY`, `DELIVERED`, `CANCELLED`, `CLOSED`;
- atendente, origem, motivo, notas, abertura e encerramento;
- snapshots somente nos documentos confirmados; a visita mantém referências canônicas.

Dependências: Workshop → Customers + Vehicles. Não existe dependência inversa nem novo módulo comercial. Gates futuros usam `workshop` e permissões mínimas `service_visits.view/create/update/close`.

## Relato do cliente

`CustomerConcern` é imutável quanto ao texto original e pertence à visita. Guarda descrição, categoria opcional, prioridade percebida, início/frequência/condição, ordem e autoria. Correções são adendos; não se mistura com `CheckInObservation` nem `DiagnosticFinding`.

## Integrações futuras

WorkOrder poderá referenciar `serviceVisitId`, mas a visita não depende dela. CRM consome eventos de relacionamento. Financeiro, Fiscal e Estoque consomem eventos confirmados de OS/venda, não o relato. Eventos candidatos à outbox: `SERVICE_VISIT_OPENED` e `SERVICE_VISIT_CLOSED`; `CUSTOMER_CONCERN_RECORDED` já integra a timeline transacionalmente pela OS.

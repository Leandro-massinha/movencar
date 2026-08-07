# Arquitetura de Atendimento

## Decisão

`ServiceVisit` será a raiz transacional do domínio Workshop e poderá existir sem orçamento ou Ordem de Serviço. A persistência foi adiada nesta branch: numeração, encerramento, reabertura e snapshots ainda precisam do primeiro fluxo funcional para evitar uma tabela vazia com invariantes erradas.

## Contrato planejado

- tenant e filial derivados da sessão e validados por FKs compostas;
- Customer e Vehicle obrigatoriamente da mesma empresa; a política para veículo sem proprietário presente será explícita;
- número sequencial por empresa/filial com estratégia concorrente;
- estados iniciais recomendados: `OPEN`, `CHECKED_IN`, `UNDER_EVALUATION`, `WAITING_APPROVAL`, `IN_SERVICE`, `READY`, `DELIVERED`, `CANCELLED`, `CLOSED`;
- atendente, origem, motivo, notas, abertura e encerramento;
- snapshots somente nos documentos confirmados; a visita mantém referências canônicas.

Dependências: Workshop → Customers + Vehicles. Não existe dependência inversa nem novo módulo comercial. Gates futuros usam `workshop` e permissões mínimas `service_visits.view/create/update/close`.

## Relato do cliente

`CustomerConcern` é imutável quanto ao texto original e pertence à visita. Guarda descrição, categoria opcional, prioridade percebida, início/frequência/condição, ordem e autoria. Correções são adendos; não se mistura com `CheckInObservation` nem `DiagnosticFinding`.

## Integrações futuras

Quote e WorkOrder referenciam `serviceVisitId`, mas a visita não depende deles. CRM consome eventos de relacionamento. Financeiro, Fiscal e Estoque consomem eventos confirmados de OS/venda, não o relato. Eventos candidatos à outbox: `SERVICE_VISIT_OPENED`, `CUSTOMER_CONCERN_RECORDED`, `SERVICE_VISIT_CLOSED`.

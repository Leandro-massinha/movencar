# Arquitetura da Ordem de Serviço

## Decisão operacional

Todo veículo que entra fisicamente recebe uma Ordem de Serviço. A OS é o registro oficial da entrada, não uma afirmação de serviço aprovado. Uma avaliação ou diagnóstico recusado termina como `CLOSED_NO_SERVICE` e continua no prontuário.

`ServiceVisit` permanece reservado como contexto amplo de interação. Uma ligação ou consulta futura pode existir sem OS; uma visita com entrada física sempre terá WorkOrder. A implementação inicial não persiste ServiceVisit para evitar duplicidade: WorkOrder é a raiz operacional atual e poderá receber `serviceVisitId` opcional quando interações não presenciais forem funcionais.

## Modelo implementado

`WorkOrder` referencia Company, Branch, Customer, Vehicle e atendente por relações tenant-safe. O número é inteiro, sequencial e único por empresa, alocado atomicamente por `WorkOrderSequence`; UUID permanece identidade interna. `operationKey`, não retornada pela API, torna retries de abertura idempotentes.

Finalidades: diagnóstico, avaliação, manutenção, reparo, inspeção, revisão, garantia, cortesia, retorno e outro. Nesta fase os estados são deliberadamente pequenos: aberta, cancelada, encerrada sem serviço e encerrada. Check-in, PDC, diagnóstico, orçamento, aprovação, execução e espera são fases/agregados próprios, não dezenas de estados na OS.

## Encerramento

O fluxo implementado permite cancelamento ou encerramento sem serviço. Este último exige motivo estruturado: preço, adiamento, falta de autorização, peça indisponível, desistência, retirada, segunda opinião ou outro. Constraints relacionam status, `closedAt` e motivo. Encerramento usa compare-and-swap em `OPEN`; chamadas concorrentes não duplicam timeline ou AuditLog.

## Segurança e integrações

O módulo comercial é `workshop`, dependente de Customers e Vehicles. A criação valida filial, cliente e veículo ativos na empresa autenticada. Eventos implementados: `WORK_ORDER_OPENED`, `WORK_ORDER_CLOSED_NO_SERVICE` e `WORK_ORDER_CANCELLED`. Quilometragem de entrada usa a série canônica e só eleva a projeção atual.

Orçamento, aprovação, execução, peças, estoque, financeiro, fiscal, garantia e CRM serão agregados/relações posteriores. Nenhum deles é embutido em JSON ou implementado nesta etapa.

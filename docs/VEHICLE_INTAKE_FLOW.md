# Fluxo de Entrada do Veículo

## Fluxo oficial de entrada do MovenCar

1. Identificar ou cadastrar Cliente e Veículo com os dados mínimos.
2. Abrir uma OS numerada para toda entrada física, escolhendo sua finalidade.
3. Registrar um ou mais relatos originais do cliente.
4. Criar o Check-in documental em rascunho, sem presumir itens não verificados.
5. Concluir o Check-in e registrar quilometragem/condição observável.
6. Executar PDC e teste de rodagem inicial quando seguro e autorizado.
7. Produzir diagnóstico técnico e orçamento em agregados distintos.
8. Registrar aprovação ou recusa e preservar recomendações pendentes.
9. Se aprovado, executar serviço e teste final; se recusado, encerrar sem serviço com motivo.
10. Entregar o veículo e alimentar prontuário, garantia, manutenção futura e CRM.

## Entrada versus interação

Uma consulta por telefone não cria OS. Quando ServiceVisit for implementado, representará essa interação. A presença física do veículo é o limite inequívoco que exige WorkOrder.

## Classificação desta etapa

Implementado agora: WorkOrder, sequência, idempotência, CustomerConcern, Check-in com checklist versionado, mapa de avarias, PDC em rascunho/conclusão, timeline, AuditLog e odômetro.

Preparado: tipos avançados de resposta/evidência, teste inicial/final, confirmação, snapshots, retificações e relatório de entrada.

Adiado: orçamento completo, aprovação, execução, estoque, financeiro, fiscal, CRM funcional, comunicação, portal, BI e diagnóstico eletrônico.

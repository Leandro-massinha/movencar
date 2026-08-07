# Arquitetura do PDC

PDC — Primeiro Diagnóstico do Carro é uma avaliação técnica inicial, separada do Relato do Cliente, do Check-in, do teste de rodagem e do diagnóstico técnico definitivo.

`PreliminaryVehicleDiagnostic` pertence à empresa, filial, OS, veículo e técnico da sessão. Só pode começar após Check-in concluído. Existe um PDC não cancelado por OS nesta etapa. `PdcFinding` mantém categoria, localização opcional, estado observacional, prioridade técnica, descrição, recomendação, flag de atenção imediata e sequência determinística.

Somente `DRAFT` é editável. Mutações de findings bloqueiam o PDC pai durante a transação; conclusão usa compare-and-swap. Assim, o vencedor cria exatamente um `PDC_COMPLETED`, uma leitura de odômetro quando informada e um AuditLog, sem aceitar alteração tardia concorrente. Quilometragem histórica menor é aceita sem reduzir `Vehicle.currentMileage`. PDC concluído é imutável pelas APIs normais.

`PDC_STARTED` e `PDC_COMPLETED` aparecem resumidos no Histórico do Veículo. Findings não viram serviços, orçamento ou bloqueio automático. Retificação, teste de rodagem, diagnóstico definitivo, orçamento, fotos, assinatura e relatório permanecem etapas futuras.

# Eventos Internos

## Contrato planejado

Eventos internos desacoplarão efeitos entre módulos dentro do monólito. Envelope mínimo: `eventId`, `type`, `occurredAt`, `companyId`, `branchId?`, `actorUserId?`, `sourceType`, `sourceId` e payload versionado. Consumidores nunca substituem o tenant do envelope por dados do payload.

Exemplos futuros: `WORK_ORDER_COMPLETED`, `SALE_COMPLETED`, `PAYMENT_RECEIVED`, `VEHICLE_CHECKED_IN`, `VEHICLE_RELEASED` e `INVOICE_ISSUED`. Vehicle History, Inventory, Finance, CRM, Warranty e Communication poderão consumir esses contratos sem o produtor importar seus serviços.

O prontuário acrescenta contratos planejados `VEHICLE_OWNER_CHANGED`, `ODOMETER_RECORDED`, `SERVICE_VISIT_OPENED`, `CUSTOMER_CONCERN_RECORDED`, `CHECK_IN_STARTED`, `CHECK_IN_COMPLETED` e `CHECK_IN_CONFIRMED`. O produtor deve fornecer chave idempotente de origem. Atualização da projeção corrente, leitura de odômetro e evento essencial de timeline permanecem na mesma transação.

## Política de consistência

- efeito obrigatório para a consistência da operação permanece na mesma transação;
- efeito secundário não pode fazer a operação principal parecer concluída se sua perda for silenciosa;
- quando houver necessidade real de entrega confiável, implementar outbox PostgreSQL transacional, worker idempotente e tentativas observáveis;
- um event bus apenas em memória não oferece durabilidade e, por isso, não foi implementado nesta etapa;
- handlers devem ser idempotentes por `eventId`, registrar falhas e não engolir exceções.

Não serão introduzidos Kafka, RabbitMQ ou microserviços antes de carga e requisitos operacionais justificarem isso.

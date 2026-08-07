# Vehicle 360°

## Entidade canônica

`Vehicle` continua canônico. `customerId` permanece como projeção rápida do proprietário atual para retrocompatibilidade; `VehicleOwnershipHistory` passa a preservar a verdade temporal. `currentMileage` continua um resumo monotônico; `VehicleOdometerReading` preserva a série histórica.

## Implementado agora

### Propriedade

- uma linha corrente do tipo `OWNER` por veículo, garantida por índice único parcial;
- troca via atualização existente do veículo encerra a linha anterior e cria a nova na mesma transação;
- período válido exige `validUntil >= validFrom`; linha corrente não possui término;
- relações com Vehicle, Customer e autor são compostas por tenant;
- histórico não possui exclusão silenciosa.

### Quilometragem

- leitura imutável com fonte, data, filial, usuário e referência de origem;
- criação e atualização do veículo registram leitura quando há quilometragem;
- evento manual com quilometragem também registra a série;
- leitura maior pode elevar `currentMileage`; leitura histórica menor é preservada sem reduzi-lo;
- constraint impede valor negativo.

Consultas: `GET /api/vehicles/:id/ownership` e `GET /api/vehicles/:id/odometer-readings`, paginadas até 100 e protegidas por módulo Vehicles e `vehicles.view`.

WorkOrder e Check-in reutilizam a mesma série. Quilometragem de entrada usa origem `WORK_ORDER`; conclusão do Check-in usa `CHECK_IN`. Cada leitura referencia o evento de timeline que identifica a operação, e somente valores maiores elevam `currentMileage`.

## Preparado e documentado

- `VehicleTechnicalProfile` apenas quando novos atributos técnicos tiverem fluxo de manutenção próprio;
- componentes e instalações com posição, datas, quilometragem, garantia e referências futuras a produto/OS;
- pneus como especialização posicional (`FL`, `FR`, `RL`, `RR`, `SPARE`) sobre componentes/inspeções;
- bateria, fluidos, modificações e acessórios como históricos, não colunas booleanas em Vehicle;
- documentos e fotos pela capacidade central de arquivos.

## Concorrência e idempotência

O índice parcial impede dois proprietários atuais. A troca usa compare-and-swap em `Vehicle.customerId`: somente a requisição que ainda encontra o proprietário esperado pode alterar a projeção, encerrar o período e criar o sucessor na mesma transação. A perdedora recebe conflito e não produz ownership, timeline ou AuditLog. Isso mantém `Vehicle.customerId` igual ao `OWNER` atual mesmo em João → Maria concorrente com João → Carlos.

A elevação de quilometragem continua condicional e atômica. Em 55.000 × 52.000 vence a maior projeção; a leitura menor deve entrar pelo fluxo histórico quando representar data anterior. Em 55.000 × 55.000 apenas uma atualização gera timeline/leitura e a outra é no-op. Leituras usam o ID do evento de timeline como identidade da operação, com índice único parcial por empresa, fonte e `sourceId`. Submissões manuais distintas continuam sendo fatos independentes; uma futura API com retry externo deverá exigir chave de idempotência.

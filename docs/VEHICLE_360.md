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

## Preparado e documentado

- `VehicleTechnicalProfile` apenas quando novos atributos técnicos tiverem fluxo de manutenção próprio;
- componentes e instalações com posição, datas, quilometragem, garantia e referências futuras a produto/OS;
- pneus como especialização posicional (`FL`, `FR`, `RL`, `RR`, `SPARE`) sobre componentes/inspeções;
- bateria, fluidos, modificações e acessórios como históricos, não colunas booleanas em Vehicle;
- documentos e fotos pela capacidade central de arquivos.

## Concorrência e idempotência

O índice parcial impede dois proprietários atuais. A troca ocorre na mesma transação da projeção `customerId`; conflito aborta tudo. A elevação de quilometragem continua condicional e atômica. Produtores futuros devem usar uma chave idempotente por origem antes de registrar leitura/evento automático.

# Arquitetura de Teste de Rodagem

Teste inicial e final são instâncias do mesmo conceito, diferenciadas por fase. Cada registro pertence à OS e ao veículo, identifica motorista/técnico, horários, quilometragens inicial/final, distância derivada, duração, notas e status.

Um teste não executado registra motivo (`NOT_REQUIRED`, `UNSAFE_VEHICLE`, `CUSTOMER_DID_NOT_AUTHORIZE`, `NO_LICENSED_DRIVER`, `VEHICLE_IMMOBILE`, `WEATHER`, `OTHER`); ausência nunca significa resultado normal.

Itens observacionais usam `OK`, `ISSUE`, `NOT_CHECKED` e `NOT_APPLICABLE`. Resultados inicial e final permanecem separados e podem ser comparados por leitura futura, sem sobrescrita ou inferência automática.

A persistência foi adiada até o fluxo técnico do PDC. Quilometragens futuras reutilizarão `VehicleOdometerReading` com origens `ROAD_TEST_INITIAL` e `ROAD_TEST_FINAL`; será necessária migration incremental para essas origens, sem sistema paralelo.

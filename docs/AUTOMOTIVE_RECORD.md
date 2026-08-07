# Prontuário Automotivo

O prontuário é uma projeção de leitura centrada em Vehicle, não uma tabela única. Ele compõe identificação, propriedade, odômetro, timeline, atendimentos, relatos, check-ins, inspeções, diagnósticos, documentos, componentes, garantias e transações mantendo cada domínio como fonte de verdade.

A fundação de entrada adiciona WorkOrder como registro obrigatório da presença física, CustomerConcern como relato original imutável e VehicleCheckIn como condição observável em rascunho/conclusão. A timeline recebe somente eventos resumidos; os agregados preservam o detalhe.

## Arquivos e fotos

`FileAsset` e `Attachment` foram preparados conceitualmente e adiados até existir upload autorizado. `FileAsset` guarda tenant, uploader, nome original apenas como metadata, MIME validado pelo conteúdo, tamanho, storage key opaca gerada pelo backend, checksum, estado e data. `Attachment` liga o arquivo a um recurso autorizado por referência tenant-safe. Binários ficam em storage privado exclusivo do MovenCar; download revalida tenant e permissão do pai. Não haverá path fornecido pelo cliente, URL pública previsível ou tabela de foto por módulo.

## Assinatura

A assinatura futura é um FileAsset privado acompanhado de confirmação imutável: nome, instante, versão do documento/checklist, usuário responsável e metadata mínima de dispositivo/IP sob política LGPD. O hash do documento confirmado permite provar qual conteúdo foi aceito.

## Divergências

`Discrepancy` relacionará referências imutáveis a Concern, Observation e Finding, com descrição neutra, status e resolução humana. Não acusa origem, não altera evidência e não depende de IA.

## Timeline

Vehicle History continua a timeline pública resumida. Entidades profundas mantêm seus próprios registros; eventos automáticos apontam `sourceType/sourceId`, são criados na transação quando essenciais e usarão outbox quando efeitos assíncronos forem introduzidos.

## Roadmap do prontuário automotivo

1. API e UI de propriedades e leituras de odômetro.
2. Atendimento mínimo e relato original do cliente.
3. Check-in em rascunho/conclusão com template versionado.
4. Arquivos privados, fotos obrigatórias e confirmação do cliente.
5. Inspeções e diagnóstico técnico separados.
6. Orçamento e aprovação vinculados ao atendimento.
7. Ordem de Serviço, execução e instalação de componentes.
8. Entrega, garantia e manutenção preventiva.
9. Pneus, bateria, fluidos e modificações.
10. Projeções Customer/Vehicle 360°, CRM, Financeiro, Fiscal e BI.

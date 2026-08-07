# Linguagem do Produto MovenCar

Português do Brasil (`pt-BR`) é o idioma oficial da experiência do usuário. Código, APIs, models Prisma, permissões e enums permanecem em inglês. Todo enum técnico exibido deve passar por um mapa de rótulos em `src/i18n/pt-BR.ts`; datas, números e documentos usam `src/i18n/formatters.ts`.

## Glossário oficial

| Conceito técnico              | Termo exibido                     |
| ----------------------------- | --------------------------------- |
| Dashboard                     | Visão Geral                       |
| Customer                      | Cliente                           |
| Vehicle                       | Veículo                           |
| Vehicle History               | Histórico do Veículo              |
| Mileage                       | Quilometragem                     |
| Branch                        | Filial                            |
| Work Order                    | Ordem de Serviço                  |
| Quote                         | Orçamento                         |
| Inventory                     | Estoque                           |
| Supplier                      | Fornecedor                        |
| Purchase / Sale               | Compra / Venda                    |
| Accounts Payable / Receivable | Contas a Pagar / Contas a Receber |
| Cash Flow                     | Fluxo de Caixa                    |
| Cost Center                   | Centro de Custos                  |
| Appointment                   | Agendamento                       |
| Bay                           | Box                               |
| Technician                    | Técnico                           |
| Warranty                      | Garantia                          |
| Module / Subscription         | Módulo / Assinatura               |
| Permission                    | Permissão                         |
| Audit Log                     | Auditoria                         |
| Settings                      | Configurações                     |
| Search / Filter               | Pesquisar / Filtrar               |
| Check-in                      | Check-in                          |
| Check-out                     | Entrega do veículo                |
| Service Visit                 | Atendimento                       |
| Customer Concern              | Relato do cliente                 |
| Observation                   | Observação                        |
| Diagnostic Finding            | Diagnóstico técnico / Constatação |
| Ownership                     | Propriedade                       |
| Odometer                      | Quilometragem                     |
| Damage                        | Avaria                            |
| Attachment                    | Anexo                             |
| Checklist Template            | Modelo de Lista de Verificação    |

CRM, PIX, WhatsApp, NF-e, NFC-e, NFS-e, RENAVAM e Check-in permanecem por serem termos consolidados. `Checklist` é apresentado como “Lista de Verificação” em navegação destinada ao usuário geral.

## Escrita e ações

Use frases diretas, acentuação correta e verbos consistentes: Novo, Adicionar, Salvar, Salvar alterações, Cancelar, Excluir, Editar, Visualizar, Pesquisar, Filtrar, Limpar filtros, Anterior, Próxima, Voltar, Fechar, Confirmar, Continuar, Entrar e Sair.

Mensagens não expõem Axios, Prisma, Zod, SQL, stack traces ou códigos internos. Estados vazios explicam o que ocorreu e a ação possível. Confirmações destrutivas informam que o registro sairá das consultas normais e que dados históricos serão preservados.

## Novos módulos

Todo módulo nasce com nome comercial, menus, permissões exibidas, validações, mensagens, tabelas, filtros e estados vazios em pt-BR. Isso vale para Oficina, Auto Elétrica, Auto Center, Estética, Estoque, Compras, Vendas, Financeiro, Fiscal, CRM, Comunicação, Pneus, Funilaria, Ferramentas, Pátio, Garantias, RH, Portal do Cliente e Relatórios.

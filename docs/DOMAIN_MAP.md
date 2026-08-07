# Mapa de Domínios

| Domínio | Responsabilidade | Dependências permitidas |
| --- | --- | --- |
| Core | empresa, filiais, usuários, auth, sessões, papéis, permissões, módulos, assinatura, gate, auditoria, arquivos, eventos e integrações | nenhuma comercial |
| Customers | cadastro, endereços, contatos, preferências, consentimentos, tags e origens | Core |
| Vehicles | veículo, histórico, quilometragem, fotos e propriedade futura | Core, Customers |
| Workshop | agenda, recepção, check-in, checklist, diagnóstico, orçamento, aprovação, OS, execução, técnicos, boxes e saída | Customers, Vehicles, Catalog |
| Catalog | produtos, serviços, categorias, marcas e listas de preço | Core |
| Inventory | depósitos, saldos, locais, movimentos, reservas, transferências, inventários, perdas, lotes e séries | Catalog |
| Purchasing | fornecedores, solicitações, cotações, pedidos, recebimentos e devoluções | Catalog, Inventory |
| Sales | balcão, pedidos, itens, descontos, vendedores, comissões e pagamentos | Customers, Catalog; Inventory opcional |
| Finance | receber, pagar, caixa, bancos, conciliação, centros de custo, plano de contas, fluxo e DRE | Core; eventos de Sales/Workshop |
| Fiscal | perfis fiscais, regras tributárias, NF-e, NFC-e, NFS-e, XML e DANFE | Core, Customers, Catalog; consumido por Sales/Workshop |
| CRM | leads, oportunidades, pipelines, atividades, campanhas, retenção e reativação | Customers, Communication |
| Communication | WhatsApp, e-mail, SMS, push, notificações, templates e logs | Core |
| Detailing | pacotes, etapas, antes/depois, condição, profissionais, boxes e consumíveis | Workshop, Vehicles, Catalog |
| Tires | especificação, posição, DOT, rodízio, balanceamento, alinhamento e desgaste | Vehicles, Workshop, Catalog |
| Body Shop | mapa de danos, etapas, pintura, seguradora, fotos e terceiros | Workshop, Vehicles, Files |
| Tools & Assets | ferramentas, equipamentos, empréstimo, manutenção, calibração e localização | Core, HR/Team |
| Yard | vagas, localização, chaves, entrada/saída e estados de espera | Vehicles, Workshop |
| Warranty | garantia de serviço/peça e retornos vinculados à OS original | Workshop, Catalog |
| Preventive Maintenance | planos e regras por tempo/quilometragem | Vehicles, Catalog |
| HR / Team | funcionários, técnicos, funções, habilidades, produtividade e escalas | Core |
| Customer Portal | veículos, aprovações, status, arquivos, pagamentos e documentos | fachadas de Customers/Vehicles/Workshop/Finance/Fiscal |
| Reports / BI | métricas e projeções de leitura | eventos/projeções dos domínios; não é fonte transacional |
| Integrations | adapters fiscais, pagamentos, comunicação, contabilidade, ERP, dados veiculares, catálogo e webhooks | contratos Core |

Dependências inversas e circulares são proibidas. Integrações transversais devem usar interfaces ou eventos. Files é uma capacidade Core, não uma tabela de foto por módulo.

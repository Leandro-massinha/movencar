# Arquitetura Fiscal

Fiscal é módulo opcional e não altera o schema base por tipo de negócio. `Company`, `Customer`, `Product` e `Service` continuam canônicos. Dados especializados serão extensões tenant-safe.

## Perfis planejados

- `CompanyFiscalProfile`: CNPJ, inscrições, regime, CNAE, ambientes, séries e configurações por documento;
- `CustomerFiscalProfile`: RG/órgão emissor, inscrições e indicadores fiscais que não são universais;
- `ProductFiscalProfile`: NCM, CEST, origem e regras de ICMS;
- `ServiceFiscalProfile`: código municipal, ISS e classificação de mão de obra.

Customer já suporta PF/PJ, documento, nome/fantasia, contato e inscrição estadual. Endereço deve evoluir com propósito (`RESIDENTIAL`, `COMMERCIAL`, `BILLING`, `DELIVERY`, `FISCAL`, `OTHER`) e código IBGE quando o módulo Fiscal demandar, sem tornar esses campos obrigatórios globalmente.

Product e Service serão entidades distintas. Orçamento, OS e venda usarão linhas discriminadas ou referências explícitas; serviço não herdará tributação de produto.

## Snapshots obrigatórios

Invoice, WorkOrder, Quote, Sale, Receipt e Warranty devem guardar snapshots imutáveis dos dados apresentados na transação. O registro mantém `customerId` para rastreabilidade, mas nome, documento e endereço históricos não dependem de futuras alterações no Customer. O mesmo vale para descrições, preços e dados fiscais de itens.

## Providers e segredos

O domínio dependerá de interfaces como `FiscalProvider.issue`, nunca de SDK específico. Implementações de fornecedor traduzem DTOs e erros na borda. Certificados, senhas e tokens ficam criptografados ou em secret manager exclusivo do MovenCar; banco armazena apenas referências/metadata segura. Logs e AuditLog nunca recebem segredo ou certificado.

Esta etapa não cria perfis, notas, numerações nem integração SEFAZ/Prefeitura.

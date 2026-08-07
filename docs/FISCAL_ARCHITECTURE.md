# Arquitetura Fiscal

Fiscal é módulo opcional e não altera o schema base por tipo de negócio. `Company`, `Customer`, `Product` e `Service` continuam canônicos. Dados especializados serão extensões tenant-safe.

## Perfis

- `CompanyFiscalProfile`: CNPJ, inscrições, regime, CNAE, ambientes, séries e configurações por documento;
- `CustomerFiscalProfile`: implementado como complemento com indicador de contribuinte, inscrições e endereço fiscal do próprio cliente. RG e órgão emissor pertencem a `CustomerIdentityProfile`;
- `ProductFiscalProfile`: NCM, CEST, origem e regras de ICMS;
- `ServiceFiscalProfile`: código municipal, ISS e classificação de mão de obra.

Customer suporta PF/PJ, documento, nome/fantasia e nascimento. Endereço evoluiu com finalidade e código IBGE sem tornar esses campos obrigatórios globalmente. O campo legado de inscrição estadual permanece durante a transição.

Product e Service serão entidades distintas. Orçamento, OS e venda usarão linhas discriminadas ou referências explícitas; serviço não herdará tributação de produto.

## Snapshots obrigatórios

Invoice, WorkOrder, Quote, Sale, Receipt e Warranty devem guardar snapshots imutáveis dos dados apresentados na transação. O registro mantém `customerId` para rastreabilidade, mas nome, documento e endereço históricos não dependem de futuras alterações no Customer. O mesmo vale para descrições, preços e dados fiscais de itens.

## Providers e segredos

O domínio dependerá de interfaces como `FiscalProvider.issue`, nunca de SDK específico. Implementações de fornecedor traduzem DTOs e erros na borda. Certificados, senhas e tokens ficam criptografados ou em secret manager exclusivo do MovenCar; banco armazena apenas referências/metadata segura. Logs e AuditLog nunca recebem segredo ou certificado.

O perfil de Customer não implementa notas, tributação, numeração ou integração SEFAZ/Prefeitura.

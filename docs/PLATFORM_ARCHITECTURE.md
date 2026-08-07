# Arquitetura da Plataforma MovenCar

## Decisão estrutural

O MovenCar é um monólito modular: uma API Node.js, uma SPA React e um PostgreSQL exclusivos do produto. Domínios têm fronteiras de código e contratos explícitos, mas continuam no mesmo processo e banco. Microserviços, filas externas e bancos por segmento não fazem parte desta fase.

O Core é dono de Company, Branch, User, autenticação, sessão, Role, Permission, Module, CompanyModule, auditoria e, futuramente, arquivos, integrações e eventos internos. Customer e Vehicle são entidades centrais compartilhadas; módulos consumidores referenciam seus IDs tenant-safe e não criam cópias como `FiscalCustomer`.

## Regras de dependência

- módulos de negócio podem depender do Core;
- módulos especializados reutilizam Customers, Vehicles e Catalog quando aplicável;
- o Core não importa módulos comerciais;
- comunicação transversal futura passa por contratos ou eventos internos, evitando chamadas circulares;
- tabelas relacionadas com escopo empresarial carregam `companyId` e usam FK composta quando ambos os lados pertencem a tenant;
- nenhum módulo aceita `companyId` do cliente HTTP.

## Extensão sem tabela gigante

Dados universais permanecem na entidade central. Dados especializados vivem em perfis 1:1 tenant-safe, por exemplo `CustomerFiscalProfile`, `CustomerCommunicationPreference` e `CompanyFiscalProfile`. Esses perfis só serão migrados quando um caso funcional aprovado exigir persistência.

Customer continua canônico para Fiscal, CRM, Workshop e Sales. Consentimentos devem registrar finalidade, base/origem, data e revogação; preferências de comunicação não substituem consentimento. Endereços ganharão propósito e código IBGE somente quando o fluxo correspondente for implementado.

## Arquivos e anexos

A capacidade futura terá `FileAsset` (metadata: tenant, uploader, MIME validado, tamanho, storage key opaca, checksum e data) separado de `Attachment` (vínculo autorizado com entidade). Binários ficam em object storage exclusivo do MovenCar, não no PostgreSQL. Downloads validarão tenant e permissão do recurso pai; nenhuma entidade aceitará storage key arbitrária do frontend.

## Providers

Integrações dependem de portas do domínio (`FiscalProvider`, `PaymentProvider`, `CommunicationProvider`, `VehicleDataProvider`). Adapters de fornecedores vivem na borda, traduzem contratos e nunca vazam DTOs/segredos externos para entidades centrais. Webhooks exigirão assinatura, idempotência, tenant resolvido por credencial interna e trilha de auditoria.

## Decisões adiadas

BusinessType, perfis fiscais, catálogo, anexos e event bus estão contratualmente definidos nos documentos desta etapa, mas não receberam tabelas vazias. Isso evita migrations prematuras sem impedir evolução compatível.

## Riscos auditados

- permissões eram tratadas como disponibilidade comercial; corrigido com `CompanyModule` e gate central;
- menu era filtrado apenas por permissão; agora também considera módulos retornados por `/auth/me`;
- documentação anterior descrevia apenas oficina; substituída por mapa multissegmento;
- relações antigas de User, Session e AuditLog ainda merecem hardening tenant-safe incremental já registrado em `DEVELOPMENT_PROGRESS.md`.

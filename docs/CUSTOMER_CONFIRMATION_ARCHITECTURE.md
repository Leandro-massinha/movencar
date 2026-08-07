# Arquitetura de Confirmação do Cliente

Confirmação não é somente uma imagem de assinatura. `CustomerConfirmation` futuro vinculará empresa, OS, cliente, documento, versão, método, nome confirmado, instante, hash do conteúdo, autor e metadata mínima de rede/dispositivo sob política LGPD.

O documento confirmado será um snapshot JSON controlado apenas da representação entregue ao cliente. O domínio continua normalizado; o snapshot existe para reprodução histórica e recebe hash criptográfico. A assinatura gráfica será FileAsset privado opcional.

Métodos planejados: assinatura presencial, link remoto, Portal do Cliente, link de WhatsApp e link de e-mail. Tokens serão opacos, expiráveis e de uso controlado.

Após confirmação, o conteúdo original não muda. `DocumentAmendment` registra motivo, autor, instante, diferenças e nova versão; uma nova confirmação não apaga versões anteriores. A persistência foi adiada até FileAsset e geração reproduzível do Relatório de Entrada estarem aprovados.

# Arquitetura do Mapa de Avarias

`CheckInDamage` registra condição observável na entrada e nunca representa diagnóstico técnico. Cada registro pertence por FKs compostas à mesma empresa, OS, Check-in, veículo e usuário observador. Localização, tipo e severidade usam enums; descrição é evidência complementar.

Avarias são criadas somente enquanto o Check-in está em `DRAFT`. Depois da conclusão não podem ser removidas ou alteradas silenciosamente pelas APIs normais. Cada criação real gera `DAMAGE_RECORDED` resumido na timeline e `DAMAGE_CREATE` no AuditLog; textos livres não são copiados para metadata.

O header de idempotência identifica a criação. Retry com o mesmo payload devolve a mesma avaria; reutilização da chave com payload diferente retorna conflito. A criação bloqueia o Check-in em rascunho durante a transação, impedindo que uma avaria seja confirmada depois da conclusão concorrente.

A primeira UI usa um esquema responsivo de áreas clicáveis do veículo. Fotos permanecem adiadas até `FileAsset/Attachment` e storage privado existirem; nenhum botão de upload inoperante é exibido.

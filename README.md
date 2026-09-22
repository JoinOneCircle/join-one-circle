# Join One Circle

Nova plataforma SEND, construída de forma independente do Little Steps.

## Princípios da primeira entrega

- Um record autorizado por criança, sem Community, feed, posts ou grupos.
- Acesso mínimo necessário: família, escola/SENCO, profissionais e Local Authority só veem a criança à qual foram autorizados.
- Cada alteração relevante gera evento de auditoria; documentos serão privados por padrão.
- Circle AI deverá consultar somente dados autorizados e nunca alterar um record sem revisão humana.

## Como iniciar

1. Criar o projeto Supabase na conta da cliente.
2. Executar, em ordem, todas as migrations em `supabase/0001_foundation.sql` até `supabase/0012_persistent_ai_rate_limits.sql` no SQL Editor.
3. Copiar `.env.example` para `.env.local` e preencher as chaves públicas do Supabase.
4. Executar `npm install` e `npm run dev`.

O esquema não cria dados reais de crianças. Antes de produção, é obrigatório configurar o domínio e URLs de redirecionamento, SMTP próprio, backups, políticas operacionais, DPIA e teste de segurança independente. A MFA por aplicativo autenticador já está disponível para cada conta; a política de exigência para a equipa deve ser definida pela organização.

## Demonstração local

Sem chaves Supabase, o ambiente de desenvolvimento abre uma demonstração local. Crianças, itens do record, ações, perfil e rascunhos de convite ficam no `localStorage` do navegador; arquivos de exemplo ficam no IndexedDB. Os dados sobrevivem a atualização da página no mesmo navegador, mas **não são autenticados, sincronizados, compartilhados ou seguros para dados reais de crianças**. Convites da demonstração são apenas rascunhos: nenhum e-mail é enviado e nenhuma permissão é concedida. Não use informações pessoais reais nessa modalidade.

Em `/privacy`, a demonstração permite consultar auditoria local, restaurar versões anteriores de dados do registro, simular o ciclo de acesso sem conceder permissões, exportar metadados JSON e apagar tudo que foi salvo neste navegador. A retenção configurada nessa tela é aplicada manualmente a auditoria, versões e cenários de acesso encerrados; não apaga automaticamente registros ativos nem inclui bytes de arquivos no JSON exportado.

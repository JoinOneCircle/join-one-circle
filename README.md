# Join One Circle

Nova plataforma SEND, construída de forma independente do Little Steps.

## Princípios da primeira entrega

- Um record autorizado por criança, sem Community, feed, posts ou grupos.
- Acesso mínimo necessário: família, escola/SENCO, profissionais e Local Authority só veem a criança à qual foram autorizados.
- Cada alteração relevante gera evento de auditoria; documentos serão privados por padrão.
- Circle AI deverá consultar somente dados autorizados e nunca alterar um record sem revisão humana.

## Como iniciar

1. Criar o projeto Supabase na conta da cliente.
2. Executar `supabase/0001_foundation.sql` no SQL Editor.
3. Copiar `.env.example` para `.env.local` e preencher as chaves públicas do Supabase.
4. Executar `npm install` e `npm run dev`.

O esquema inicial não cria dados reais de crianças. Antes de produção, é obrigatório configurar MFA, SMTP próprio, backups, domínio, políticas operacionais, DPIA e teste de segurança independente.

# Join One Circle — modelo funcional centrado na criança

## Decisão de produto

A criança é a entidade central. Todas as informações, permissões, atividades
e comunicações existem em relação a uma criança específica. Não existem
"painéis paralelos" com cópias independentes do mesmo caso.

```text
Criança
 ├─ registro vivo (perfil, necessidades, resultados, apoio, evidências, revisões)
 ├─ pessoas autorizadas (família, escola, profissionais e autoridade local)
 ├─ documentos, ações, eventos e solicitações
 ├─ permissões por pessoa e área do registro
 ├─ histórico/auditoria
 └─ projeções de trabalho por papel, sempre derivadas do mesmo registro
```

Uma organização pode participar, mas nunca substitui o consentimento por
criança. Um vínculo institucional só amplia o acesso operacional de uma pessoa
que já recebeu um caso autorizado; não libera automaticamente todas as
crianças da organização a todos os colaboradores.

## Modelo de entidades e efeitos

| Entidade | Criada por | Relacionada a | Quem vê/edita | Efeito ao criar, alterar ou remover |
| --- | --- | --- | --- | --- |
| Criança | administrador familiar | organização familiar proprietária | administradores; demais pessoas somente com `passport` | cria o círculo inicial; alterações geram histórico e atualizam projeções autorizadas; exclusão encerra acessos e artefatos dependentes |
| Perfil | autenticação | pessoa | dono; administradores de acesso veem identificação limitada de membros | identifica o autor de contribuições, convites e confirmações |
| Organização | onboarding/admin de organização | pessoas e casos institucionais | membros ativos; ativação é controlada | verificação habilita ferramentas institucionais, sem revogar acesso direto existente |
| Vínculo de organização | admin da organização | pessoa + organização | pessoa e administradores organizacionais | determina função institucional; não é sozinho uma permissão para qualquer criança |
| Vínculo do círculo | admin familiar via convite/aceite | criança + pessoa + permissões | a própria pessoa e administradores da criança | é a fonte de verdade para leitura, contribuição, revogação e visibilidade da criança |
| Convite | administrador de acesso | criança + e-mail + função + permissões | criador; destinatário após autenticar com o e-mail correspondente | gera token de uso único; aceite cria/atualiza vínculo do círculo; revogação impede novo aceite |
| Item de registro | pessoa com contribuição na área | criança + área | pessoas com leitura na área; contribuição conforme área | atualiza a visão da criança, histórico e painéis derivados; remoção cria versão/histórico conforme política |
| Documento | pessoa com contribuição em documentos | criança + arquivo privado + escopo | somente destinatários compatíveis com área e escopo | arquivo só fica disponível após finalização; mudanças de estado criam tarefa/notificação/auditoria |
| Ação | pessoa com contribuição em ações | criança + responsável + prazo | pessoas com leitura em ações; edição por autor, responsável ou administrador | aparece no painel da criança e no dia do responsável; conclusão informa pessoas autorizadas |
| Evento/calendário | pessoa autorizada | criança + participantes | participantes autorizados | atualiza agenda, tarefa/pendência e notificações; confirmação/cancelamento entra no histórico |
| Solicitação | família, escola ou profissional autorizado | criança + área + destinatário | remetente, destinatário e administrador | cria uma pendência explícita; resposta se liga ao documento/item/evento correspondente |
| Confirmação | destinatário da solicitação ou documento | criança + objeto confirmado | remetente, confirmador e administrador | salva pessoa, data e estado; atualiza pendências, histórico e notificações |
| Notificação | sistema a partir de evento de domínio | pessoa + criança + entidade de origem | somente destinatário | não concede acesso; somente aponta para algo que o usuário já pode abrir |
| IA | usuário autorizado | criança + conversa privada por usuário | dono da conversa; contexto filtrado por permissões | usa apenas itens liberados pela mesma regra do registro; nunca publica nem altera dados sozinha |
| Histórico | sistema | criança + entidade + autor | administrador da criança; visão limitada por papel quando aplicável | é imutável e explica criação, atualização, confirmação, revogação e eventos de acesso |

## Matriz de permissões alvo

As permissões devem ser executadas no banco/RPC e refletidas na interface. Um
botão oculto melhora a experiência, mas não substitui RLS.

| Ação | Família administradora | Familiar convidado | Escola/profissional convidado | Membro institucional com caso | Autoridade local |
| --- | --- | --- | --- | --- | --- |
| Criar criança | sim | não | não | não | não |
| Editar identidade da criança | sim | não, salvo delegação explícita | não | não | não |
| Convidar/remover pessoas | sim | somente se virar administrador | não | não | não |
| Ver área do registro | todas | áreas concedidas | áreas concedidas | áreas concedidas para o caso | áreas concedidas para o caso |
| Contribuir em área | todas | áreas concedidas | áreas concedidas | áreas concedidas para o caso | áreas concedidas para o caso |
| Enviar documento | sim | se `documents:contribute` | se `documents:contribute` | se `documents:contribute` | se `documents:contribute` |
| Elevar escopo de documento | sim | não | não | não | não |
| Confirmar documento/solicitação | sim, quando destinatária | se destinatário | se destinatário | se destinatário | se destinatário |
| Criar/alterar evento | sim | se participante/editor | se participante/editor | se participante/editor | se participante/editor |
| Ver histórico completo | sim | não | não | conforme delegação auditável | conforme delegação auditável |
| Usar IA | se área `ai` | se área `ai` | se área `ai` | se área `ai` | se área `ai` |

## Fluxos obrigatórios

### Convite e acesso

1. Administrador familiar escolhe criança, destinatário, papel e áreas de
   leitura/contribuição.
2. O banco salva o convite e registra o evento. O sistema entrega o link ou
   envia e-mail quando o provedor estiver configurado.
3. O destinatário cria conta ou entra usando o mesmo e-mail.
4. O aceite cria um vínculo ativo de círculo, inclui `passport` como contexto
   mínimo e preserva exatamente as áreas selecionadas.
5. A criança aparece em **Crianças compartilhadas** para o destinatário e
   abre somente as áreas permitidas.
6. Quando existir organização compatível verificada, o vínculo individual pode
   ser promovido para o caso institucional da mesma pessoa, de forma auditada.
7. Alteração/revogação de permissão invalida imediatamente as consultas e
   atualiza as interfaces abertas.

### Documento e confirmação

1. Autor autorizado cria metadados pendentes para a criança.
2. O arquivo entra no storage privado e é finalizado somente após verificação.
3. O documento recebe destinatários/escopo aprovados pelo administrador.
4. Pessoas autorizadas recebem uma notificação e uma pendência quando uma
   análise ou confirmação é solicitada.
5. O confirmador registra estado, nome, data e observação.
6. A família e os demais destinatários autorizados veem o novo estado no
   documento, no histórico e nas projeções relevantes.

### Evento, tarefa e retorno

1. Uma pessoa autorizada cria um evento para uma criança e seleciona
   participantes autorizados.
2. Participantes recebem notificação; o evento aparece no calendário da
   criança e na agenda individual.
3. Confirmação, alteração ou cancelamento cria histórico e atualiza todos os
   participantes autorizados.
4. Uma ação de acompanhamento pode ser criada a partir do evento, mantendo o
   vínculo com a criança e com o evento de origem.

## Causa → efeito obrigatório

| Ação | Persistência | Quem recebe/visualiza | Próximo efeito |
| --- | --- | --- | --- |
| Criar/alterar item do registro | `child_record_items` + versão/auditoria | membros com leitura daquela área | projeções, atividade e notificações por área atualizam |
| Enviar documento | `child_documents` + storage + auditoria | destinatários do escopo | pendência de análise/confirmação quando definida |
| Confirmar documento | confirmação + auditoria | autor, família e destinatários autorizados | contador de pendências diminui e estado fica visível |
| Criar ação | `child_actions` + auditoria | leitores de ações; responsável | aparece na criança e no painel individual do responsável |
| Concluir ação | atualização + auditoria | criador, responsável e membros da área | histórico e pendências atualizam |
| Aceitar convite | vínculo ativo + auditoria | família e convidado | criança entra na lista do convidado; permissões passam a valer |
| Revogar acesso | vínculo revogado + auditoria | administrador e pessoa revogada | acesso desaparece em consultas, documentos, ações, IA e notificações |
| Criar/alterar evento | evento + participantes + auditoria | participantes autorizados | agenda e notificações atualizam |

## Estado atual auditado e lacunas

### Já persistente

- crianças, vínculos individuais, convites, itens do registro, documentos,
  ações, conversas de IA, histórico, versões e itens institucionais genéricos;
- RLS granular para áreas do registro, ações, documentos e storage privado;
- aceite/revogação de convite e atualização em tempo real parcial.

### Não modelado ainda

- calendário/eventos/participantes/confirmações;
- solicitações estruturadas e confirmações de documento;
- notificações in-app/e-mail;
- equipe organizacional, promoção auditada de caso individual e aprovação de
  organização;
- entidades reais para plano, provisão, revisão, EHCP, consulta e decisão.

### Não pode permanecer como produto final

- dashboards com números ou prazos estáticos;
- painéis institucionais genéricos apresentados como se fossem processos reais;
- controles de escrita visíveis para usuários somente de leitura;
- escopo de documento elevado por contribuidores sem aprovação do administrador.

## Ordem de reconstrução

1. **Acesso e navegação P0:** lista universal de crianças compartilhadas,
   permissões efetivas no frontend e transição individual → organização.
2. **Segurança P0:** limitar elevação de escopo documental, definir papéis de
   equipe e auditar toda alteração de permissão.
3. **Objetos compartilhados P1:** documentos com confirmação, solicitações,
   eventos/calendário e notificações persistentes.
4. **Projeções P1:** dashboards e áreas institucionais derivados dos objetos
   reais, sem listas paralelas ou métricas fixas.
5. **QA P0/P1:** cenário com 1 família, 3 crianças, 1 escola e 2 profissionais;
   testar aceite, leitura, contribuição, revogação, atualização cruzada,
   logout/login e isolamento entre crianças.

## Critério de aceite

Nenhum card, contador ou painel pode ser publicado sem: fonte de dados,
ação que o alimenta, regra de permissão, consequência entre contas e teste de
persistência. A demonstração local continua explicitamente isolada; nunca é
evidência de que o fluxo de produção funciona.

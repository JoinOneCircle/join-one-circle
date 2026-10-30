# Join One Circle

Nova plataforma SEND, construída de forma independente do Little Steps.

## Admissão aberta de escolas no piloto — 30/10/2026

A pedido da responsável pelo projeto, escolas do piloto entram sem aprovação manual. A migration **0028** instala uma chave administrativa inicialmente desligada; o operador deve habilitar `pilot_admission_settings.school_enrolment_open` para ativar a política. A aplicação chama uma função sem parâmetros que ativa somente as organizações escolares pendentes nas quais a própria conta já tem vínculo administrativo ativo e e-mail confirmado. Não cria vínculos com outras escolas, não libera fichas de terceiros, não converte famílias/profissionais/autoridades locais e não reativa organizações ou membros suspensos. Cada ativação fica na auditoria. Fechar a chave impede novas admissões automáticas, sem revogar escolas já ativas.

O cadastro e a LP consultam a mesma chave. No modo aberto, o botão abre o painel escolar e explica o isolamento e o uso de dados fictícios nos testes. Quando a verificação manual estiver em uso, o aviso apresenta o prazo aprovado de **até 2 dias úteis** e o contato **hello@joinonecircle.com**. Suspensão é apresentada como suspensão, sem promessa de reativação automática. Convites e seleções individuais dos responsáveis continuam obrigatórios.

Testes em PostgreSQL local cobrem duas escolas independentes, idempotência, chave fechada/aberta, reexecução da migration sem redefinir a configuração, e-mail não confirmado, pais/usuários anônimos, bloqueio de alteração da chave e preservação de suspensões. A instalação da migration, por si só, não abre admissões.

No Supabase `frhrwuoktohxrjbtdutm`, 0028 foi aplicada e a chave foi habilitada após confirmação explícita. `tests/pilot-admission-deployed-transaction.sql` aprovou 14 verificações no banco remoto, com rollback de todas as suas identidades e escolas fictícias. Não foi feita aprovação em lote: a escola pendente será ativada pela própria conta administrativa no próximo acesso pela aplicação atualizada. Os testes não substituem login/entrega de e-mail reais. Suíte local: 79 testes, 78 aprovados e uma integração remota opcional omitida; lint e compilação de produção aprovados.

## Página pública e entrada do piloto — 30/10/2026

Landing page refeita com o fluxo escolar real, exploração de ficha/modelos/assinatura/acesso dos responsáveis, calendário, papéis e dúvidas frequentes em EN/PT/ES. A prévia do produto usa dados fictícios e é identificada como ilustração; não anuncia IA, cobrança, certificações ou módulos fora do piloto. Estilos isolados em CSS Modules, navegação compacta para celular e abas com teclado.

O perfil escolhido no cadastro é reutilizado na etapa seguinte. Escola vai direto ao nome da instituição; responsável recebe orientação sobre o convite vinculado ao próprio e-mail. A escolha reaparece apenas para contas antigas sem perfil ou por ação explícita em “Alterar perfil”. Erros de validação preservam o tipo de conta e a entrada escolar pela LP já sugere escola. Isso é preferência de navegação, não concessão de acesso: verificação da escola, convites e RLS permanecem obrigatórios. Não houve mudança de banco nem liberação de contas reais nesta revisão.

Validação desta revisão: 77 testes locais (76 aprovados, uma integração remota opcional omitida), incluindo renderização das etapas e metadados de cadastro com serviços simulados. No navegador: abas, teclado, FAQ, idiomas, formulário de cadastro com escola pré-selecionada e layout desktop/celular. A etapa pós-cadastro também foi testada em prévia local isolada, sem Supabase, incluindo mudança opcional de perfil e preservação do nome escolar. Não equivale a homologar entrega de e-mail ou criar novos participantes reais.

## Publicação controlada do piloto — 27/10/2026

Publicado na conta gratuita existente da Netlify em `https://joinonecircle.netlify.app`, com Supabase conectado e IA desativada. A primeira versão publicada desta rodada é o commit `d415b15` (deploy `6ae0f99ade851cc9227fde97`). O domínio próprio continua pendente de DNS/certificado; não foi comprado serviço nem alterado o DNS. O endereço de convite e o callback autorizados permanecem no HTTPS da Netlify.

Testes no endereço online, com três identidades Auth novas e uma escola/criança exclusivamente fictícias: login escolar, ficha com dados estruturados, construtor de modelo, pré-preenchimento, desenho de assinatura, bloqueio e publicação, download e inspeção visual do PDF, upload privado de PNG de 2,25 MB, evento no horário de Londres, convites individuais e botão de copiar, aceite correto, rejeição de e-mail errado e de repetição, lista de aceites para a escola e revogação pela interface. O responsável A leu somente os dois campos, o documento e o evento escolhidos; B leu apenas o nome. A atualização da ficha apareceu na projeção de A sem alterar o texto original ou a assinatura do documento. As URLs diretas de anexo/PDF escolar e a API escolar foram negadas ao responsável B. Páginas privadas sem sessão redirecionaram ao login. O convite foi conferido em EN/PT/ES.

O aviso flutuante da hospedagem gratuita podia sobrepor a barra fixa de salvar; o CSS reserva espaço quando esse aviso existe, sem removê-lo nem alterar o layout local. A lista escolar também consolida o vínculo e o convite aceito/revogado da mesma pessoa e criança, preservando o nome informado pela escola, sem mudar permissões. A suíte local passa a 70 testes (69 aprovados; a integração opcional de projeto descartável permanece omitida).

Este registro não afirma cobertura de todas as combinações de navegador, volume ou tipos de arquivo. O PDF e todos os dados usados são fictícios; não foram enviados convites a pessoas reais. Confirmação/recuperação por caixa de e-mail, backups/restauração, retenção, tratamento de arquivos maliciosos, política de MFA e revisão de privacidade/segurança continuam separados da publicação para testes. Não usar o piloto para dados reais de crianças antes dessa liberação operacional.

## Piloto escola e pais — implementação atual (26/10/2026)

### Validação nas contas atuais — 26/10/2026

No projeto Supabase `frhrwuoktohxrjbtdutm`, os recursos de 0022–0025 já estavam presentes. Foram aplicadas e verificadas **0026 e 0027**, depois do teste local de aplicação/reexecução. O banco não tinha planos do piloto antes desta rodada; nenhum plano assinado existente foi alterado. A aplicação manual foi verificada pelos objetos/funções/trigger do banco, não por um histórico de migrations da CLI inventado.

O teste transacional `tests/pilot-deployed-transaction.sql` aprovou **33 verificações no banco remoto**, com rollback de todas as suas identidades e registros. Separadamente, o navegador usou contas Auth independentes e uma escola exclusivamente fictícia para validar login, criação de ficha, convite gerado pela interface, rejeição pelo e-mail errado, aceite pelo destinatário, uso único, seleção individual de dois responsáveis, atualização da ficha, leitura de documento assinado e evento selecionados, revogação individual e suspensão da escola de teste. A publicação/alteração/revogação/suspensão desta rodada foram disparadas pelo SQL Editor: as mutações de escola usaram as RPCs com `SET LOCAL ROLE authenticated`; a leitura dos pais usou suas sessões Auth reais no navegador. Isso não equivale a todas as operações terem sido clicadas na interface escolar remota.

Upload real: PNG sintético de **2.360.852 bytes** enviado pela escola ao bucket privado e baixado com SHA-256 idêntico (`77415267d0dd054a96cb116661899a996f0a31285dcb220fb33240a93549ed98`). O responsável sem permissão não conseguiu abrir a URL de download do anexo; as consultas anônimas às tabelas do piloto e ao objeto privado também foram negadas. Os anexos brutos continuam exclusivos da escola.

Escopo QA: escola `b0ee0136-23a1-414d-ae14-f95fbf8a98b0`, criança `4a4fe3c9-9ad6-4c16-bd72-7e6acebf1cd1`, documento publicado `949414db-2bf8-4ec0-b8f9-16e54dd213d3`. Os dados estão identificados como fictícios e a escola foi **suspensa ao encerrar**. Quatro contas QA foram criadas, sem mensagens para destinatários reais. Nenhuma escola real recebeu novo acesso. Credenciais e tokens de convite não constam deste relatório. Nenhum serviço foi contratado ou atualizado de plano; **não houve deploy na Netlify**.

Ainda faltam: configurar SMTP próprio (está desativado no painel), comprovar entrega de confirmação/recuperação em caixas controladas, publicar esta versão e repetir a checagem no endereço HTTPS. O Site URL e o callback Netlify já constam no Supabase; o build deve receber `NEXT_PUBLIC_SITE_URL=https://joinonecircle.netlify.app`, não o localhost do arquivo de desenvolvimento. Convites são links para a escola copiar/compartilhar; envio automático por e-mail não foi implementado. Antes de dados reais também permanecem os requisitos de MFA, backups/restauração, retenção, tratamento de arquivos maliciosos e revisão de segurança/privacidade. Não se trata de certificação nem autorização para dados reais de crianças.

0027 associa novos lembretes à versão publicada exata, sem ampliar permissões nem o conteúdo dos pais. Lembretes antigos só abrem um documento diretamente quando há uma única versão publicada para a criança e a mesma data de revisão; em caso de dúvida, abrem a lista de documentos da criança.

Revisão de experiência do piloto: o cadastro não força mais três etapas. Salve os dados essenciais e abra a ficha; apoios são grupos opcionais, e anexos, planos e responsáveis ficam disponíveis conforme a tarefa. Listas têm busca e filtros; planos não selecionam a primeira criança automaticamente. O painel inicial leva à ficha ou ao documento indicado. Modelos da escola e biblioteca inicial estão separados, com prévia; o construtor tem navegação por seções, exemplos e proteção contra alterações não salvas.

Cada responsável tem nome, vínculo, e-mail e seleção próprios; antes de criar o link há revisão do destinatário e conteúdo. Novo responsável nunca herda a seleção de outro. A prévia local exige escolher uma pessoa e não une permissões de pais diferentes. Convite por e-mail automático não foi implementado: cria-se um link de uso único para copiar e compartilhar. Convites pendentes/expirados podem ser revisados e renovados, invalidando o link anterior sem reativar acessos revogados.

Esta atualização exige as migrations **0022–0027**, em ordem: base escolar, contatos individuais, data única de revisão, renovação segura de convite, assinatura desenhada/tabelas de acompanhamento e vínculo exato dos lembretes. No projeto acima, elas foram verificadas e as duas pendentes aplicadas; em outro ambiente, aplicar somente o que faltar. As funções preservam a checagem de acesso e salvam o contato no contexto da criança, sem alterar o perfil global do responsável. Para modelos com campo `review_on` do tipo data, esse mesmo valor determina o lembrete do calendário; versões já assinadas não são migradas nem modificadas.

O fluxo novo está implementado em código: ficha escolar → modelo com seções/campos → pré-preenchimento → revisão → assinatura da escola → versão bloqueada → publicação → seleção do que cada responsável pode ler. Há calendário, lembrete de revisão e PDF escolar das versões assinadas/publicadas. Novos modelos ISP/APDR/intervenção oferecem itens repetidos para objetivos, critérios de sucesso, responsáveis, apoios, execução e evidências de revisão. A revisão reaproveita os objetivos do próprio documento sem duplicar ou apagar evidências; não é um módulo de custos, biblioteca de metas do TES ou integração MIS. O piloto não usa IA, não cobra assinaturas e não inclui a operação dos portais profissionais/autoridades locais.

- `/children`: ficha estruturada criada e mantida pela escola.
- `/templates`: construtor e 20 rascunhos-base originais para revisão. Não são formulários oficiais de autoridades locais nem réplicas certificadas do TES.
- `/learning-plans`: versões congeladas; mudar a ficha não altera documentos existentes. Corrigir um documento assinado exige nova versão.
- `/parent-access`: por responsável, selecionar campos da ficha, documentos publicados e eventos. Novos contatos propõem apenas o nome da criança para identificação, removível antes da confirmação. Contatos existentes mantêm a seleção salva, sem ampliação automática. Convites reais são links de uso único, vinculados ao e-mail confirmado, com validade de sete dias; a escola copia e compartilha o link. Criar o link não envia e-mail automaticamente.
- `/parent`: apenas leitura da seleção autorizada, sem controles de edição, download ou impressão. Isso não impede capturas de tela ou cópia por uma pessoa autorizada a visualizar.
- `/documents`: documentos publicados e anexos privados da escola. Os anexos brutos ainda não são compartilháveis com os pais por essa seleção.
- `/calendar`: eventos persistentes e lembretes; publicar um plano com data de revisão cria um evento. Eventos só aparecem aos pais quando selecionados.

Assinatura: desenho com mouse/dedo/caneta, nome e função, usuário autenticado, data/hora e hash incluindo o desenho. O mesmo traço aparece no documento e no PDF; desfazer/limpar só está disponível antes de assinar. A assinatura não é copiada para a nova versão e documentos antigos permanecem intactos; não é assinatura digital certificada por provedor externo. Na demonstração, a assinatura é somente simulação sem validade.

### Banco e publicação

Aplicar **`supabase/0022_school_parent_pilot.sql` até `0027_pilot_review_plan_link.sql` após 0021**, primeiro em ambiente de teste. Em banco novo, aplicar 0001–0027 em ordem; em banco existente, verificar o histórico e os objetos efetivos, aplicando somente as pendentes — não repetir migrations antigas indiscriminadamente. O estado do projeto atual e os testes reais estão no registro acima. Não houve deploy nem conversão de círculos familiares legados.

O ambiente real precisa de escola verificada, conta escolar ativa e vínculo explícito de cada colaborador à criança. RLS e funções do banco impõem as restrições; esconder botões não concede nem revoga acesso. Alterações são recarregadas ao focar a janela e em até 15 segundos; há também suporte à sincronização existente. Atualizações concorrentes antigas são recusadas. Revogar impede novas consultas, mas não desfaz conteúdo já visto.

Antes de dados reais: aplicar/verificar a migration, testar dois usuários independentes com aceite/revogação, redirects e confirmação de e-mail/recuperação de senha, Storage, domínio HTTPS, MFA, backups/restauração, retenção e revisão de segurança/privacidade. Configurar `CIRCLE_AI_ENABLED=false`. A prévia não prova que a configuração remota está correta.

### Validação desta implementação

Reteste local de regressão em 26/10: proteção de rascunhos em Voltar/Avançar e links, versão e destinatário mantidos na URL/recarregamento, busca sem acento, idiomas entre abas, seleção individual, prévia de documento completo, atualização/revogação e calendário. Na rodada anterior, as subtarefas não tiveram navegador disponível e fizeram revisão independente de código, testes e capturas. Foi exercitada nova assinatura fictícia, publicação, lembrete da versão exata e download de PDF identificado com criança/título/versão. A seleção de criança na área geral mantém Anexos aberta. A validação posterior de Auth/Storage reais está discriminada acima; envio de e-mail e deploy seguem pendentes.

Checks finais: `npm run lint`, `npx tsc --noEmit`, `npm run build` e `node --test --test-isolation=none` aprovados. A suíte atual tem **66 testes (65 aprovados; uma integração remota opt-in omitida)**. O teste omitido usa um projeto descartável e não foi apontado ao banco da cliente; os testes remotos realizados nesta rodada estão separados no registro acima. PostgreSQL isolado aplica 0001–0027 e verifica RLS, e-mail correto, uso único, renovação, data canônica, limites por criança, imutabilidade, concorrência e revogação. A prévia visual anterior foi conferida em desktop/celular e EN/PT/ES. PDF sintético com acentos, tabelas e assinatura foi renderizado e inspecionado na rodada anterior. A auditoria anterior das dependências de produção estava sem alertas; não equivale a uma nova auditoria nesta revisão.

Sem conexão configurada, o localhost usa somente dados fictícios no navegador. Nenhum convite é enviado e nenhuma permissão real é concedida. Para revisar a interface: Crianças → Modelos → Planos → Compartilhar com os pais. A prévia dos pais usa apenas a seleção simulada no mesmo navegador.

As notas abaixo descrevem a construção anterior e limites históricos; o escopo e os caminhos novos acima prevalecem para o piloto escolar.

## Reconstrução visual — escola e pais

A composição foi revisada contra a referência exportada: header de 64 px (60 px no celular), logo menor, tipografia independente do painel antigo, rail escolar de cinco acessos sem os módulos legados no menu, tabela sem busca duplicada e lembretes futuros ao lado do calendário. Os dados e endpoints antigos não foram apagados. A interface de destino ainda está sendo reconstruída; essa revisão não implementa assinatura nem o novo construtor de documentos.

A primeira etapa da nova interface está implementada: cabeçalho sem rótulos de workspace/piloto, navegação curta com ícones distintos e ferramentas adicionais em “Mais”, busca das crianças autorizadas, notificações e painel inicial da escola com crianças, documentos, planos, ações e calendário. Os contadores e lembretes vêm das consultas autenticadas existentes, protegidas por RLS; falhas de carregamento são exibidas, não substituídas por números fictícios. O layout foi conferido em desktop, tablet e celular, em inglês, português e espanhol. A troca direta entre idiomas preserva agora o texto original.

Sem Supabase, o painel informa que é uma demonstração local. Eventos criados no calendário de prévia são temporários e não são enviados à escola. Não use dados pessoais reais nessa modalidade.

Esta etapa **não conclui o novo piloto**: criação manual da ficha pela escola, construtor de templates com pré-preenchimento, assinatura/publicação imutável e acesso dos pais estritamente de leitura precisam de implementação e validação próprias. A reconstrução visual não modifica permissões do banco nem torna os fluxos antigos equivalentes a essas novas regras. Não foi aplicado deploy ou migration nesta etapa.

Validação local: `npm run lint`, `npx tsc --noEmit`, `npm run build` e `node --test --test-isolation=none` (alternativa quando o sandbox bloqueia os processos separados do runner). O teste de integração com Supabase permanece opt-in e não prova, quando omitido, o funcionamento de um ambiente remoto.

## Princípios da primeira entrega

- Um record autorizado por criança, sem Community, feed, posts ou grupos.
- Acesso mínimo necessário: família, escola/SENCO, profissionais e Local Authority só veem a criança à qual foram autorizados.
- Cada alteração relevante gera evento de auditoria; documentos serão privados por padrão.
- Circle AI deverá consultar somente dados autorizados e nunca alterar um record sem revisão humana.

## Como iniciar

1. Criar o projeto Supabase na conta da cliente.
2. Em banco novo, executar as migrations `0001` a `0027` em ordem. Em banco existente, verificar o histórico e aplicar apenas as pendentes.
3. Copiar `.env.example` para `.env.local` e preencher as chaves públicas do Supabase.
4. Executar `npm install` e `npm run dev`.

O esquema não cria dados reais de crianças. Antes de produção, é obrigatório configurar o domínio e URLs de redirecionamento, SMTP próprio, backups, políticas operacionais, DPIA e teste de segurança independente. A MFA por aplicativo autenticador já está disponível para cada conta; a política de exigência para a equipa deve ser definida pela organização.

## Demonstração local

Durante a reconstrução, `/dashboard` abre por padrão a nova prévia da escola. A preferência antiga `joc_demo_role` não é mais usada; uma escolha explícita de outro perfil em `/onboarding` grava a preferência versionada `joc_demo_role_v2`. Isso não apaga dados locais nem altera funções ou permissões de contas Supabase.

Sem chaves Supabase, o ambiente de desenvolvimento abre uma demonstração local. Crianças, itens do record, ações, perfil e rascunhos de convite ficam no `localStorage` do navegador; arquivos de exemplo ficam no IndexedDB. Os dados sobrevivem a atualização da página no mesmo navegador, mas **não são autenticados, sincronizados, compartilhados ou seguros para dados reais de crianças**. Convites da demonstração são apenas rascunhos: nenhum e-mail é enviado e nenhuma permissão é concedida. Não use informações pessoais reais nessa modalidade.

Em `/privacy`, a demonstração permite consultar auditoria local, restaurar versões anteriores de dados do registro, simular o ciclo de acesso sem conceder permissões, exportar metadados JSON e apagar tudo que foi salvo neste navegador. A retenção configurada nessa tela é aplicada manualmente a auditoria, versões e cenários de acesso encerrados; não apaga automaticamente registros ativos nem inclui bytes de arquivos no JSON exportado.

## Teste de integração do círculo real

`npm test` não cria contas nem altera um banco. Para validar o fluxo real de RLS e RPCs — pai → convite → aceite → acesso ao perfil → documento com escopo → confirmação → notificação — use somente um projeto Supabase local ou dedicado de testes:

```powershell
$env:JOC_RUN_LIVE_INTEGRATION = "1"
$env:SUPABASE_TEST_URL = "http://127.0.0.1:54321"
$env:SUPABASE_TEST_ANON_KEY = "..."
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = "..."
npm run test:integration
```

O teste cria duas contas `@example.test` e remove os dados ao terminar. Para um alvo remoto de testes, além de usar credenciais próprias desse projeto, defina conscientemente `JOC_ALLOW_REMOTE_TESTS=1`. O comando recusa fazer mutações remotas sem essa confirmação.

Ainda não há uma API para um administrador indicar um convidado comum como participante de calendário: hoje os participantes são o criador e os administradores de acesso da criança. Esse limite é registrado pelo teste, em vez de ser mascarado com inserções de serviço.

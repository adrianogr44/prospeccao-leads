# Prospecção de Leads

Ferramenta local para encontrar empresas que precisam de um site novo. Pesquisa por segmento e cidade, analisa o site de cada empresa, mede a oportunidade em um termômetro (Quente, Aquecida, Morna, Fria, Gelada), mostra tudo em um mapa e abre o WhatsApp com a proposta pronta.

Fontes de dados: **Google Places API** (oficial) e **OpenStreetMap**. Não faz raspagem do Google Maps.

## Instalação

Requisito: Node.js 20 ou mais novo.

```bash
npm install
cp .env.example .env        # no Windows: copy .env.example .env
npm run db:migrate
npm run build
npm start
```

Abra http://localhost:3000.

Para desenvolver: `npm run dev`.

## Configuração (`.env`)

| Variável | Para quê | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Caminho do banco SQLite | Sim (já vem preenchida) |
| `CONTACT_EMAIL` | Identificação enviada ao OpenStreetMap e aos sites analisados | Sim |
| `GOOGLE_PLACES_API_KEY` | Busca no Google. Sem ela, o sistema usa só o OpenStreetMap | Não |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Exportação para Google Sheets | Não |
| `RECEITA_CNPJ_BASE_URL` | Endereço dos Dados Abertos de CNPJ. Só mexa se a Receita trocar o link | Não |
| `RECEITA_CNPJ_TOKEN` | Token do compartilhamento público da Receita. Idem | Não |

### Chave do Google Places

1. Entre em https://console.cloud.google.com e crie um projeto.
2. Ative o faturamento (o Google exige cartão, mesmo com cota gratuita).
3. Em "APIs e serviços", ative **Places API (New)**.
4. Em "Credenciais", crie uma chave de API e restrinja à Places API (New).
5. Cole em `GOOGLE_PLACES_API_KEY` e reinicie o sistema.

Custo: cada consulta devolve até 20 empresas e é cobrada na faixa mais cara da Places API, porque pede telefone e site. O histórico de pesquisas mostra quantas consultas cada uma fez. Defina um limite de gasto no Google Cloud antes de rodar pesquisas grandes.

### Google Sheets

1. No mesmo projeto do Google Cloud, ative **Google Sheets API**.
2. Crie uma conta de serviço e baixe a chave JSON.
3. Cole o JSON inteiro, em uma linha, em `GOOGLE_SERVICE_ACCOUNT_JSON`.
4. Compartilhe a planilha de destino com o e-mail da conta de serviço, como Editor.
5. No dashboard: Exportar > Google Sheets, e informe o link da planilha. Cada exportação cria uma aba nova.

## Como usar

1. **Pesquisas**: informe categoria, cidade, estado e raio. A pesquisa roda em segundo plano, pode ser pausada e continua sozinha se o sistema for reiniciado.
2. **Dashboard**: responde "quem eu abordo agora?". O funil de prospecção (Encontradas → Precisam de site → Com contato → **Prontas para abordar** → Contatadas) filtra a lista com um clique; o mapa mostra as empresas do filtro, com as quentes em âmbar; a lista abre cada empresa em um painel ao lado, com motivo, destino, mensagem e o botão de envio. Atalhos: `J`/`K` próxima e anterior, `E` enviar, `N` anotar, `C` copiar, `M` recolher o mapa, `/` buscar, `?` lista de atalhos.
3. **Exportar**: Excel, CSV, JSON ou Google Sheets, sempre com os filtros aplicados.
4. **Agendamentos**: repete uma pesquisa todo dia, semana ou mês. Só roda com o sistema aberto.
5. **Receita Federal**: cruza a lista com os Dados Abertos de CNPJ para achar telefone e e-mail de quem não publicou contato no mapa. Veja abaixo.
6. **Enviar proposta**: em cada empresa há um botão que abre o WhatsApp com a mensagem de oferta já escrita. Veja abaixo.
7. **Configurações**: nome da sua empresa, remetente, planos, custos de hospedagem e domínio, e o modelo da mensagem.

## Contatos pela Receita Federal

O OpenStreetMap quase nunca tem telefone e a Places API do Google exige cartão de crédito. Os **Dados Abertos de CNPJ** da Receita são públicos, oficiais e gratuitos, e traz por estabelecimento o endereço completo, o CNAE, a situação cadastral, dois telefones e um e-mail.

Na tela **Receita**: informe a cidade (e a UF) e clique em "Importar e cruzar". A importação roda em segundo plano, mostra em que etapa está, pode ser pausada e continua sozinha se o sistema for reiniciado.

**O que acontece em cada etapa**

1. **Municípios**: baixa `Municipios.zip` (43 KB) e descobre o código da Receita da cidade pedida. O código não é o do IBGE (Campinas é 6291); a tabela não tem UF, então a UF informada é que desempata homônimos como Campinas, Campinas do Sul e Campinas do Piauí.
2. **Estabelecimentos**: lê `Estabelecimentos0.zip` a `Estabelecimentos9.zip` **em fluxo**, sem gravar o CSV em disco e sem carregar nada na memória. Só as linhas dos municípios pedidos vão para a tabela local `Cnpj`; o resto é descartado durante a leitura.
3. **Razão social**: lê `Empresas0.zip` a `Empresas9.zip` e completa a razão social dos estabelecimentos **ativos** já guardados. As 10 partes são sempre lidas, porque os CNPJ básicos se espalham por todas elas.
4. **Cruzamento**: casa cada empresa da lista com um estabelecimento e grava o contato.

**Como o cruzamento decide**

O nome da empresa passa pela mesma normalização do dedupe (minúsculas, sem acento, sem pontuação, sem `ltda`/`me`/`eireli`) e é comparado com o nome fantasia e a razão social dos estabelecimentos **ativos** do município. A confiança vai de 0 a 1:

| Sinal | Peso |
|---|---|
| Nome fantasia idêntico | 1,00 |
| Razão social idêntica | 0,90 |
| Nome da empresa é o começo do nome do CNPJ | 0,75 |
| Mesmo bairro | +0,10 |
| Mesmo logradouro | +0,10 |

**Limiar: 0,80.** Nome idêntico casa sozinho; nome só parecido exige confirmação de bairro ou de logradouro. Se dois estabelecimentos empatam no topo, nenhum é usado (a empresa fica sem contato em vez de receber o telefone errado), e isso aparece como "Sem desempate" no cartão da importação.

**O que é gravado**

- Só campo vazio. WhatsApp, telefone e e-mail já existentes nunca são tocados.
- O telefone entra como `Telefone`, no formato `+55 DD NNNNNNNNN`, com a marca de celular quando for o caso. **Nunca** como WhatsApp: a Receita não diz que o número atende no WhatsApp.
- A origem e o mês do dump ficam registrados e aparecem no painel da empresa, junto do aviso de que é dado cadastral.
- A nota é recalculada. O score em si não muda (ele não pesa telefone), mas a empresa sai de "sem contato" e entra em **Prontas para abordar** no funil.

**Custo e tempo** (medido no dump de 2026-09, para Campinas/SP)

| | Baixado | Tempo | Guardado |
|---|---|---|---|
| Uma parte dos estabelecimentos (amostra) | ~340 MB + ~1,4 GB de Empresas | ~3 min de estabelecimentos | 36.904 linhas |
| Dump completo | ~5,1 GB + ~1,4 GB de Empresas | cerca de 1 hora | ~250 mil linhas |

Nada disso fica no disco além da tabela `Cnpj`: os .zip são lidos enquanto baixam. Rodar de novo não duplica nada (o CNPJ é a chave) e vale para atualizar com o dump do mês seguinte.

**Sem a importação o sistema funciona como hoje** — a tela Receita explica o que fazer e o dashboard não muda.

## Abordagem (botão "Enviar proposta")

O botão aparece em toda linha da lista (preso à direita) e no painel de cada empresa. Ele abre uma conversa no WhatsApp (link `wa.me`) com a mensagem preenchida; quem envia é você. O sistema não dispara mensagens sozinho, porque isso viola os termos do WhatsApp e pode bloquear o número.

- A frase de abertura muda conforme a situação: sem site, só rede social, site antigo, site fora do ar.
- A mensagem pode ser editada antes de cada envio, no painel de detalhe.
- Ao clicar, a empresa fica marcada como "Contatado" (há filtro e opção de desmarcar).
- Destino, por ordem: WhatsApp publicado pela empresa; celular (WhatsApp não confirmado); e-mail; telefone fixo (só funciona se a empresa usar o fixo no WhatsApp). Sem nenhum contato, o botão vira "Adicionar WhatsApp": o painel tem um campo para colar o número que você encontrar (com atalho de busca no Google), e o envio é liberado na hora. A etapa "sem contato" do funil é a fila para esse trabalho.

Padrões que vêm de fábrica, todos editáveis em Configurações:

| Item | Padrão |
|---|---|
| Empresa / remetente | SitesCraft / Adriano |
| Oferta | Landing Page Completa por R$ 697, entrega em 7 dias |
| Incluso no valor | Domínio .com.br e hospedagem do primeiro ano |
| Custo de referência | Hospedagem R$ 27,96/mês (renovação R$ 39,90/mês) e domínio R$ 40/ano |

A tela de Configurações calcula o custo do primeiro ano e quanto sobra por venda em cada plano.

Marcadores do modelo de mensagem: `{remetente}`, `{minha_empresa}`, `{empresa}`, `{cidade}`, `{categoria}`, `{gancho}`, `{oferta}`, `{preco_inicial}`, `{planos}`, `{prazo}`, `{custos}`, `{hospedagem}`, `{dominio}`.

## Como a nota é calculada

O score vai de 0 a 100 e vira o termômetro: Quente (85+), Aquecida (65 a 84), Morna (45 a 64), Fria (25 a 44), Gelada (abaixo de 25).

| Situação | Termômetro |
|---|---|
| Sem site (confirmado pelo Google), só rede social ou site antigo | Quente |
| Sem site cadastrado no OpenStreetMap (precisa confirmar) | Aquecida |
| Site fora do ar | Aquecida a Quente |
| Site moderno | Fria a Morna |

Poucas avaliações, falta de WhatsApp e Instagram sem site aumentam a nota. Os pesos ficam em `src/server/scoring/score.ts`.

"Site antigo" é uma estimativa: o sistema procura sinais como falta de versão para celular, falta de HTTPS e ano de copyright desatualizado. Os sinais encontrados aparecem no detalhe da empresa.

## Limites

- **WhatsApp** só é preenchido quando a empresa publica um link de WhatsApp. Telefone celular aparece como "Celular".
- **Nome do proprietário** quase nunca está disponível em fontes públicas.
- **OpenStreetMap** não tem nota nem avaliações, cobre menos empresas pequenas e raramente traz telefone ou site. Para prospectar de verdade, configure a chave do Google Places.
- **Google Places** ainda não foi testado com chave real: a busca pelo Google está implementada e coberta por testes de mapeamento, mas não rodou ao vivo.
- Os dados do Google devem ser renovados periodicamente (use os agendamentos).
- **Receita Federal**: o cadastro só tem nome fantasia em cerca de 40% dos estabelecimentos, e o nome informal que aparece no mapa muitas vezes não é nem o nome fantasia nem a razão social. Por isso o cruzamento acha contato para uma parte das empresas, não para todas. O endereço do dump é um compartilhamento Nextcloud e já mudou duas vezes; se parar de responder, atualize `RECEITA_CNPJ_BASE_URL` e `RECEITA_CNPJ_TOKEN`.

## Privacidade (LGPD)

O sistema guarda apenas informações comerciais que a própria empresa publicou e dados cadastrais de pessoa jurídica de fonte oficial e pública (Dados Abertos de CNPJ). Base legal: legítimo interesse para prospecção B2B.

Em MEI e empresário individual o telefone do cadastro da Receita pode ser um número pessoal. Por isso a origem do contato aparece sempre junto do número, com esse aviso, e entra também na exportação. Excluir uma empresa no dashboard apaga os dados (inclusive o que veio da Receita) e impede que ela volte em pesquisas futuras.

O sistema não tem login: use só no seu computador e não exponha na internet.

## Docker (opcional)

```bash
docker compose up --build
```

## Desenvolvimento

```bash
npm run lint
npm run typecheck
npm test
```

Documentação em `docs/`: brief, PRD, especificação de interface, arquitetura, e em `docs/design/` a direção visual "Radar noturno" (UX, sistema visual, tema e auditoria). O sistema de design implementado está resumido em `.interface-design/system.md`.

O mapa usa Leaflet com tiles do OpenStreetMap (precisa de internet; sem ela, os pontos aparecem sobre fundo liso).

Estrutura:

```
prisma/              modelos do banco
src/lib/contract.ts  contrato da API
src/app/             páginas e rotas /api
src/components/      interface
src/server/          coleta, análise de site, score, exportação, agendador
src/server/cnpj/     importação dos Dados Abertos de CNPJ e cruzamento com os leads
```

# Prospecção de Leads

Ferramenta local para encontrar empresas que precisam de um site novo. Pesquisa por segmento e cidade, analisa o site de cada empresa, dá uma nota de oportunidade de 1 a 5 estrelas e exporta para planilha.

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
2. **Dashboard**: as melhores oportunidades aparecem primeiro. Use os filtros e clique em uma empresa para ver os detalhes e os motivos da nota.
3. **Exportar**: Excel, CSV, JSON ou Google Sheets, sempre com os filtros aplicados.
4. **Agendamentos**: repete uma pesquisa todo dia, semana ou mês. Só roda com o sistema aberto.
5. **Enviar proposta**: em cada empresa há um botão que abre o WhatsApp com a mensagem de oferta já escrita. Veja abaixo.
6. **Configurações**: nome da sua empresa, remetente, planos, custos de hospedagem e domínio, e o modelo da mensagem.

## Abordagem (botão "Enviar proposta")

O botão aparece na tabela e no painel de detalhe de cada empresa. Ele abre uma conversa no WhatsApp (link `wa.me`) com a mensagem preenchida; quem envia é você. O sistema não dispara mensagens sozinho, porque isso viola os termos do WhatsApp e pode bloquear o número.

- A frase de abertura muda conforme a situação: sem site, só rede social, site antigo, site fora do ar.
- A mensagem pode ser editada antes de cada envio, no painel de detalhe.
- Ao clicar, a empresa fica marcada como "Contatado" (há filtro e opção de desmarcar).
- Destino, por ordem: WhatsApp publicado pela empresa; celular (WhatsApp não confirmado); e-mail; telefone fixo (só funciona se a empresa usar o fixo no WhatsApp). Sem nenhum contato, resta "Copiar mensagem".

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

| Situação | Estrelas |
|---|---|
| Sem site (confirmado pelo Google), só rede social ou site antigo | 5 |
| Sem site cadastrado no OpenStreetMap (precisa confirmar) | 4 |
| Site fora do ar | 4 a 5 |
| Site moderno | 2 a 3 |

Poucas avaliações, falta de WhatsApp e Instagram sem site aumentam a nota. Os pesos ficam em `src/server/scoring/score.ts`.

"Site antigo" é uma estimativa: o sistema procura sinais como falta de versão para celular, falta de HTTPS e ano de copyright desatualizado. Os sinais encontrados aparecem no detalhe da empresa.

## Limites

- **WhatsApp** só é preenchido quando a empresa publica um link de WhatsApp. Telefone celular aparece como "Celular".
- **Nome do proprietário** quase nunca está disponível em fontes públicas.
- **OpenStreetMap** não tem nota nem avaliações, cobre menos empresas pequenas e raramente traz telefone ou site. Para prospectar de verdade, configure a chave do Google Places.
- **Google Places** ainda não foi testado com chave real: a busca pelo Google está implementada e coberta por testes de mapeamento, mas não rodou ao vivo.
- Os dados do Google devem ser renovados periodicamente (use os agendamentos).

## Privacidade (LGPD)

O sistema guarda apenas informações comerciais que a própria empresa publicou. Excluir uma empresa no dashboard apaga os dados e impede que ela volte em pesquisas futuras. O sistema não tem login: use só no seu computador e não exponha na internet.

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

Documentação em `docs/`: brief, PRD, especificação de interface e arquitetura.

Estrutura:

```
prisma/              modelos do banco
src/lib/contract.ts  contrato da API
src/app/             páginas e rotas /api
src/components/      interface
src/server/          coleta, análise de site, score, exportação, agendador
```

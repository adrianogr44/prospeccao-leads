# Arquitetura — Prospecção de Leads

Status: Validado em 30/09/2026

## 1. Visão geral

Um único app Next.js (App Router, TypeScript estrito) que roda localmente e concentra dashboard, API, coletor, enriquecimento, exportações e agendador. Banco SQLite via Prisma. Sem serviços externos obrigatórios além das fontes de dados.

```
Navegador ──► Next.js (src/app)
               ├─ páginas (dashboard, pesquisas, agendamentos)
               └─ /api/* (route handlers, validados com zod)
                     │
                     ▼
              src/server (só servidor)
               ├─ jobs/runner      fila em processo, 1 pesquisa por vez, retomável
               ├─ jobs/scheduler   verifica agendamentos a cada minuto
               ├─ providers/       google (Places API New) | osm (Nominatim + Overpass)
               ├─ enrich/          análise do site oficial da empresa
               ├─ scoring/         score 0-100 e estrelas 1-5
               ├─ leads/           upsert, dedupe, filtros, DTO
               └─ export/          csv, xlsx, json, Google Sheets
                     │
                     ▼
               Prisma ──► SQLite (prisma/dev.db)
```

## 2. Decisões e motivos

| Decisão | Motivo |
|---|---|
| APIs oficiais (Places API New) + OpenStreetMap; sem raspagem do Google Maps | Raspar o Maps viola os Termos do Google. O briefing exige respeito aos termos |
| Next.js único em vez de FastAPI + Next | Python bloqueado no PC (Device Guard); um processo só é mais simples de instalar e manter |
| SQLite | Uso local, um usuário, dezenas de milhares de linhas. Trocar para PostgreSQL = mudar `provider` e a URL |
| Fila em processo (sem Redis) | Uso local de um usuário. Estado da fila persistido no banco, então sobrevive a reinício |
| WhatsApp só quando publicado | O briefing proíbe inferir. Celular é marcado à parte (`phoneIsMobile`) sem afirmar que é WhatsApp |
| Agendador por `setInterval` | Evita dependência; precisão de 1 minuto basta |

## 3. Estrutura de pastas

```
prisma/schema.prisma          modelos
src/lib/contract.ts           contrato da API (zod + tipos), usado por front e back
src/app/                      páginas e rotas /api
src/components/               componentes de interface
src/server/db.ts              PrismaClient singleton
src/server/providers/         types.ts, google.ts, osm.ts, geocode.ts, grid.ts, index.ts
src/server/enrich/            fetch-site.ts, analyze.ts (puro), platform.ts (puro), contacts.ts (puro)
src/server/scoring/score.ts   puro
src/server/leads/             normalize.ts (puro), upsert.ts, query.ts, dto.ts
src/server/jobs/              runner.ts, scheduler.ts
src/server/export/            rows.ts, csv.ts, xlsx.ts, sheets.ts
src/instrumentation.ts        ao subir o servidor: retoma pesquisas e liga o agendador
docs/                         brief, PRD, specs, épicos, stories
```

Funções marcadas como "puro" não tocam rede nem banco e têm teste unitário (Vitest).

## 4. Coleta em grande volume

A Places API devolve no máximo 60 resultados por consulta (3 páginas de 20). Para chegar a centenas ou milhares:

1. **Geocodificar** cidade + estado no Nominatim (centro e caixa delimitadora). Cache em memória.
2. **Área de busca**: quadrado de lado `2 × raioKm` em torno do centro.
3. **Grade adaptativa (quadtree)**: a fila começa com a área inteira. Cada célula é consultada com `locationRestriction` retangular. Se a célula saturar (60 resultados no Google), é dividida em 4 e as filhas entram na fila. Profundidade máxima 6; célula menor que 300 m não divide.
4. **Continuação**: a fila de células pendentes fica em `Search.cursor` (JSON) e é gravada a cada célula concluída. Pausa, erro ou queda do servidor retomam dali.
5. **Parada**: fila vazia, `maxLeads` atingido, pausa pedida ou erro fatal (chave inválida, cota esgotada).

Progresso = células concluídas ÷ (concluídas + pendentes).

### Google (Places API New)

- `POST https://places.googleapis.com/v1/places:searchText`, `textQuery` = `"{categoria} {palavras-chave}"`, `languageCode: "pt-BR"`, `regionCode: "BR"`, `pageSize: 20`, `locationRestriction.rectangle`.
- `X-Goog-FieldMask`: `places.id,places.displayName,places.formattedAddress,places.addressComponents,places.location,places.googleMapsUri,places.websiteUri,places.rating,places.userRatingCount,places.regularOpeningHours.weekdayDescriptions,places.nationalPhoneNumber,places.internationalPhoneNumber,places.primaryTypeDisplayName,places.businessStatus,nextPageToken`.
- Erro 429/5xx: até 3 tentativas com espera crescente. 400/403: erro fatal com mensagem clara.
- Custo: os campos de contato colocam a consulta na faixa Enterprise. `requestCount` fica registrado por pesquisa para acompanhar gasto.
- Retenção: a política do Google permite guardar `place_id` sem prazo; os demais dados devem ser atualizados periodicamente. `fetchedAt` registra a última consulta e os agendamentos servem para renovar.

### OpenStreetMap

- Overpass (`https://overpass-api.de/api/interpreter`), consulta por caixa delimitadora, `nwr` com `out center tags`.
- Categoria em português → tags OSM por um dicionário (restaurante, dentista, clínica, academia, advogado, loja de roupas, auto peças, salão, barbearia, padaria, farmácia, pet shop, oficina, hotel, imobiliária, contabilidade, escola, mercado). Sem correspondência: busca por nome com `["name"~"termo",i]`.
- Uma célula única (a área inteira); acima de 50 km de lado divide em 4. Intervalo mínimo de 2 s entre chamadas. `User-Agent` com `CONTACT_EMAIL`.
- Campos: `name`, `addr:*`, `phone`/`contact:phone`, `website`/`contact:website`, `contact:whatsapp`, `contact:instagram`, `contact:facebook`, `email`/`contact:email`, `opening_hours`, `operator` (vira `ownerName`).
- OSM não tem nota nem avaliações: ficam nulos.

### Escolha da fonte (`provider`)

- `google`: exige chave; sem chave a pesquisa falha com mensagem orientando.
- `osm`: só OpenStreetMap.
- `auto`: Google se houver chave, senão OSM.

## 5. Duplicados e atualização

- Chave primária de origem: `(source, externalId)` única. Reencontrar o mesmo lugar **atualiza** o registro (preserva `notes`) e conta em `updatedCount`.
- Entre fontes: `dedupeKey` = nome normalizado (minúsculas, sem acento, sem sufixos como ltda/me/eireli) + `|` + telefone só dígitos; sem telefone, usa latitude/longitude arredondadas a 3 casas. Se já existe lead de outra fonte com a mesma chave, o novo não é criado: os campos vazios do existente são preenchidos.
- `Blocked`: lead excluído pelo usuário nunca é reimportado.
- `SearchLead` liga cada lead às pesquisas que o encontraram (histórico), com `isNew`.

## 6. Enriquecimento do site

Roda depois da coleta de cada célula, com 5 sites em paralelo. Uma única requisição GET à página inicial do site oficial que a própria empresa divulgou, tempo limite 8 s, máximo 1,5 MB lidos, `User-Agent` identificado.

Proteções: só `http`/`https`; resolve o DNS e recusa IP privado, loopback e link-local (SSRF); segue no máximo 3 redirecionamentos revalidando cada destino.

Classificação (`siteStatus`):

| Situação | Status |
|---|---|
| Sem `website` | `NONE` |
| `website` aponta para instagram.com, facebook.com, linktr.ee, wa.me, api.whatsapp.com e afins | `SOCIAL_ONLY` (o link vai para o campo da rede e `website` fica nulo) |
| Falha de DNS, tempo esgotado, 5xx, 404 | `UNREACHABLE` |
| 2 ou mais sinais de site antigo | `OLD` |
| Demais | `OK` |

Sinais de site antigo (cada um vira um texto em `siteSignals`): sem HTTPS; sem `meta viewport` (não adaptado a celular); ano de copyright 4 ou mais anos atrás; Flash, `<frameset>`, `<font>`, `<marquee>` ou layout por `<table>`; jQuery 1.x; `meta generator` de versão antiga; cabeçalho `Last-Modified` com mais de 4 anos. Sem viewport sozinho já classifica como `OLD`.

Extração na mesma página: plataforma (WordPress, Wix, Shopify, Squarespace, Webflow, Nuvemshop, Tray, Loja Integrada, Bagy, Yampi, VTEX, Blogger, Google Sites, Joomla, Drupal, Hostinger, GoDaddy, Elementor indica WordPress), links de Instagram, Facebook, LinkedIn e TikTok, WhatsApp (`wa.me/…`, `api.whatsapp.com/send?phone=…`), e-mail (`mailto:`). Só preenche campo que estava vazio.

## 7. Score

Função pura `scoreLead(lead) → { score, stars, reasons }`. Pesos em um único objeto no topo do arquivo.

| Base por situação do site | Pontos |
|---|---|
| `NONE` | 90 |
| `SOCIAL_ONLY` | 85 |
| `OLD` | 85 |
| `UNREACHABLE` | 75 |
| `UNKNOWN` | 50 |
| `OK` | 25 |

Exceção: `NONE` vindo só do OpenStreetMap parte de 65 (4 estrelas), com o motivo "Sem site cadastrado no OpenStreetMap (confirmar)". O OSM raramente registra o site, então a ausência lá é indício e não confirmação.

Ajustes: menos de 20 avaliações +10; sem WhatsApp +10; tem Instagram e não tem site +5; nota ≥ 4,3 com 50+ avaliações +5 (negócio saudável). Fechado permanentemente = 0. Teto 100.

Estrelas: ≥ 85 → 5; ≥ 65 → 4; ≥ 45 → 3; ≥ 25 → 2; abaixo → 1. `reasons` em português, por exemplo "Não tem site", "Site sem versão para celular", "Poucas avaliações (12)".

O score é recalculado em todo upsert e depois do enriquecimento.

## 8. API

Contrato completo em `src/lib/contract.ts` (esquemas zod e lista de rotas no fim do arquivo). Regras:

- Toda entrada validada com zod; erro devolve `ApiError` com status 400.
- Filtros viram `Prisma.LeadWhereInput` em um único lugar (`leads/query.ts`), reutilizado por lista, indicadores e exportação.
- Paginação no servidor. Ordenação padrão: `score desc, reviewCount desc`.
- Rotas com `export const dynamic = "force-dynamic"` e `runtime = "nodejs"`.

## 9. Exportação

Mesmas colunas em todos os formatos, cabeçalhos em português. CSV com BOM UTF-8 e separador `;` (abre direto no Excel brasileiro); células iniciadas por `= + - @` recebem apóstrofo (injeção de fórmula). XLSX com `exceljs`: cabeçalho congelado, filtro automático, largura ajustada. Google Sheets: conta de serviço (`google-auth-library` + REST), cria uma aba nova `Leads AAAA-MM-DD HHmm` na planilha informada, que precisa estar compartilhada com o e-mail da conta de serviço. Limite de 20 000 linhas por exportação.

## 10. Agendamento

`Schedule` guarda os parâmetros da pesquisa, frequência (diária, semanal, mensal) e hora. A cada minuto o agendador busca `active && nextRunAt <= agora`, cria uma `Search` ligada ao agendamento, enfileira e calcula o próximo `nextRunAt`. Só funciona com o servidor ligado; o README explica.

## 11. Segurança e LGPD

- Ferramenta local: sem login. O servidor deve escutar só em `localhost`. Não expor na internet sem colocar autenticação na frente.
- Segredos só em `.env` (fora do git). Nada de chave no frontend.
- Dados tratados: informações comerciais que a própria empresa publicou. Base legal: legítimo interesse para prospecção B2B. Excluir um lead remove os dados e bloqueia a reimportação (atende pedido de remoção).
- Saída escapada pelo React; links externos com `rel="noopener noreferrer"`.

## 12. Evolução

- PostgreSQL: trocar `provider` no schema e `DATABASE_URL`.
- Vários usuários ou volume alto: mover o runner para um worker separado com fila (BullMQ) sem mudar providers, enrich e scoring.
- Docker: `Dockerfile` e `docker-compose.yml` inclusos para subir em servidor.

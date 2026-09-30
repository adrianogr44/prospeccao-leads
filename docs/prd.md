# PRD — Prospecção de Leads

Status: Validado em 30/09/2026 · Origem: briefing do usuário + `project-brief.md`

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Pesquisar por categoria, palavras-chave, cidade, estado e raio em km |
| RF02 | Coletar de Google Places API e/ou OpenStreetMap, com escolha de fonte |
| RF03 | Paginação e continuação automáticas até esgotar a área ou atingir o limite de leads |
| RF04 | Pausar e retomar pesquisa; retomar sozinha depois de reinício do servidor |
| RF05 | Não duplicar empresa; reencontrar atualiza o registro existente |
| RF06 | Guardar por empresa: nome, categoria, cidade, estado, bairro, endereço, CEP, latitude/longitude, link do Maps, site, situação do site, plataforma do site, nota, nº de avaliações, horário, WhatsApp, telefone, e-mail, Facebook, Instagram, LinkedIn, TikTok, proprietário, observações |
| RF07 | Classificar o site: sem site, só rede social, antigo, fora do ar, moderno |
| RF08 | Detectar plataforma do site (WordPress, Wix, Shopify etc.) |
| RF09 | Score automático de 1 a 5 estrelas com os motivos |
| RF10 | Dashboard com indicadores: total, sem site, com site, com WhatsApp, sem WhatsApp, oportunidades quentes |
| RF11 | Gráficos: situação do site, estrelas, cidades, categorias, plataformas |
| RF12 | Tabela com busca instantânea, ordenação, paginação e filtros por cidade, estado, categoria, nota, nº de avaliações, tem site, tem WhatsApp, tem Instagram |
| RF13 | Exportar o resultado filtrado em Excel, CSV, JSON e Google Sheets |
| RF14 | Histórico de pesquisas com contadores (encontrados, novos, atualizados, consultas) |
| RF15 | Agendar pesquisas recorrentes (diária, semanal, mensal) |
| RF16 | Editar observações e excluir lead (exclusão bloqueia reimportação) |
| RF17 | Modo claro e escuro |

## Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Só APIs oficiais e dados abertos; nenhuma raspagem do Google Maps |
| RNF02 | Campo sem dado público fica vazio; nunca inferir |
| RNF03 | Tabela responde em menos de 300 ms com 50 000 leads (filtro e paginação no servidor, índices) |
| RNF04 | Instalação local em até 5 comandos, só com Node.js |
| RNF05 | TypeScript estrito, sem `any`; entradas validadas com zod |
| RNF06 | Interface responsiva e acessível (teclado, contraste, rótulos) |
| RNF07 | Segredos só no servidor (`.env`) |
| RNF08 | Testes unitários para score, heurística de site, dedupe, grade e CSV |

## Limitações conhecidas (informadas ao usuário)

- **Nome do proprietário**: nenhuma fonte permitida publica. Só é preenchido quando o OSM traz `operator`.
- **WhatsApp**: só quando a empresa publica link de WhatsApp no site ou no OSM. Celular aparece marcado como "celular", sem afirmar que é WhatsApp.
- **Link do Google Business**: o perfil público da empresa é o próprio link do Maps.
- **"Site antigo"** é heurística: pode errar para os dois lados; os sinais ficam visíveis para conferência.
- **OpenStreetMap** não tem nota nem avaliações e cobre menos empresas pequenas no Brasil.
- **Custo do Google**: consultas com telefone e site são da faixa mais cara da Places API. O sistema mostra quantas consultas cada pesquisa fez.

## Critérios de sucesso

- Pesquisa "Restaurante em Campinas, 10 km" devolve centenas de empresas sem intervenção.
- Empresas sem site aparecem no topo com 5 estrelas.
- Exportação abre corretamente no Excel com acentos.

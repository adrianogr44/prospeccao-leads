# Auditoria do Dashboard "Radar noturno" (story 1.5, fase C)

Data: 30/09/2026 · Branch `dev/feat/redesign-radar-noturno` · Escopo: Dashboard (`src/app/{layout,page,globals.css}`, `src/components/{ui,lead-ui,icons,modal,sidebar,theme-toggle,outreach}.tsx`, `src/components/dashboard/*`, `src/lib/{view-state,use-client-state}.ts`). Método: leitura do código com as regras do `web-design-guidelines` (Vercel) + conferência na tela com Chrome DevTools (1400×900, 1024×768 e 375×812, escuro e claro). Contraste medido com `getComputedStyle` e composição das camadas de fundo. Linhas citadas são as dos arquivos em 30/09 15:52.

## 1. Resumo

| Gravidade | Qtde | O que é |
|---|---|---|
| Alta | 2 | texto abaixo de 3:1 (funil nas 4 etapas não selecionadas; crédito do OSM) |
| Média | 8 | alvos de toque, nome repetido/ambíguo, Esc, foco perdido, atalhos, estado de erro ausente, contraste 4,2:1 |
| Baixa | 17 | polimento |

Critério 11 da story **não passa** enquanto A1 e A2 existirem. A1 também reprova o critério 6 (claro "passa AA"): 2,37:1. Fora isso, teclado, leitor de tela, movimento reduzido, rolagem horizontal em 375 px e console estão bons (seção 5).

## 2. Achados

| # | Grav. | Arquivo:linha | O que está errado | Como corrigir |
|---|---|---|---|---|
| A1 | Alta | `dashboard/funnel.tsx:111-112` | Etapa não selecionada recebe `opacity-55` no botão inteiro, inclusive rótulo e taxa de 12 px: 2,69:1 (escuro) e 2,37:1 (claro). Vale já na tela inicial (4 de 5 etapas). | Tirar a opacidade do botão; escurecer só a barra e manter rótulo/taxa em `text-muted`. |
| A2 | Alta | `globals.css:466` (+ `radar-map-canvas.tsx:4`) | O `leaflet.css` (carrega depois, mesma especificidade) vence `.radar .leaflet-control-attribution`: fundo vira `rgba(255,255,255,.8)` e o texto `#8D96A5` fica a 1,92:1 (2,21 sobre via) no escuro. Spec previa 6,35. Crédito do OSM ilegível (medido e visto na tela). | Subir a especificidade (`.radar .leaflet-container .leaflet-control-attribution`) ou `!important` no `background`; reconferir. |
| M1 | Média | `outreach.tsx:64`, `ui.tsx:44-45`, `dashboard.tsx:580`, `export-menu.tsx:176`, `filters.tsx:534`, `lead-panel.tsx:627-639`, `radar-map.tsx:259-270` | Em 375 px o botão de envio da linha mede 44×32 (`size-11` perde para o `h-8` do sm). Exportar, Nova pesquisa, tema, Filtros, busca, selects e o envio do painel têm 36; Anterior/Próxima/Fechar, zoom, Abrir mapa, Legenda, Panorama 32. Spec: 44×44. | `compact` com `h-11 w-11` forçado; `max-sm:h-11`/`size-11` nos controles de topo, painel e mapa. |
| M2 | Média | `outreach.tsx:95` | Fora do modo compacto o link de envio se chama só "Tentar WhatsApp (abre em nova aba)": 36 links idênticos para o leitor de tela (só no celular entra o nome da empresa). | `aria-label`/`sr-only` com o nome da empresa em todos os modos. |
| M3 | Média | `dashboard.tsx:332`, `lead-list.tsx:93` | Esc em textarea/input é ignorado. Enter na linha leva o foco à mensagem (textarea) e ali Esc não fecha o painel; na gaveta (≤1279 px) fecha. Comportamento muda por largura (verificado). | 1º Esc em campo devolve o foco ao título/linha, 2º fecha; ou tratar Esc nos dois textareas. |
| M4 | Média | `radar-map.tsx:140-156,293-302`, `lead-panel.tsx:336-361,531-544` | O botão acionado é desmontado e o foco cai em `body`: Recolher/Abrir mapa (verificado: foco volta ao "Ir para o conteúdo"), Excluir empresa (confirmação troca o botão; só no código, a tecla foi bloqueada pelo ambiente) e Desmarcar (sem anúncio). | Um único botão com `open`, ou focar o controle novo após a troca; anunciar o desmarcar em `aria-live`. |
| M5 | Média | `dashboard.tsx:320-372` | Atalhos de tecla única (J K E N C M / ?) globais, sem como desligar ou remapear (WCAG 2.1.4, nível A). Com empresa selecionada, E abre o WhatsApp e marca contatada de qualquer foco: um toque errado envia a proposta. | Ativar só com foco na lista/painel; opção "Desativar atalhos" no quadro; E exigir confirmação ou Shift. |
| M6 | Média | `panorama.tsx:88-101`, `dashboard.tsx:554` | Se `/api/stats` falha o Panorama fica em esqueleto para sempre (`aria-hidden`, sem erro nem "Tentar de novo"). Reproduzido com 500 simulado. | Passar `stats.error`/`reload` e mostrar `ErrorState`. |
| M7 | Média | `dashboard.tsx:546`, `radar-map.tsx:147-153,295-301`, `lead-list.tsx:269` | Nomes ambíguos: Panorama é só "Abrir"/"Recolher"; "Recolher M", "Abrir mapa M", "Atalhos ?" porque o `Kbd` entra no nome. | `aria-label` ("Recolher Panorama", "Recolher mapa") e `aria-hidden` no `Kbd` (`ui.tsx:518`). |
| M8 | Média | `lead-list.tsx:119,136` | Linha contatada aplica `opacity-60` ao termômetro: rótulo "Quente" cai a 4,20:1 (12 px) na linha selecionada. | Usar cor (`text-muted`) no rótulo; opacidade só nos segmentos. |
| B1 | Baixa | `globals.css:380`, `ui.tsx:127`, `export-menu.tsx:18` | `focus:outline-none` com anel em `box-shadow`: some em alto contraste (forced-colors). | `forced-colors:outline-2` ou `outline: 2px solid transparent`. |
| B2 | Baixa | `globals.css` (base) | Sem `touch-action: manipulation` nem `-webkit-tap-highlight-color`. | Regra global em `button, a, select, input`. |
| B3 | Baixa | `modal.tsx:58-63,111-117`, `dashboard.tsx:645`, `lead-panel.tsx:437` | Sem `overscroll-behavior: contain` na gaveta, folha e rolagens internas. | `overscroll-contain`. |
| B4 | Baixa | `lead-list.tsx:386-390` | Select "Por página" sem `id`/`name` (issue do console). | `id` e `name`. |
| B5 | Baixa | `dashboard.tsx:365`, `lead-list.tsx:271-291` | `?` abre o quadro de atalhos sem mover o foco nem anunciar. | Focar o quadro (`tabIndex=-1`) ao abrir por tecla. |
| B6 | Baixa | `filters.tsx:537,431-447` | Gatilho diz `aria-haspopup="dialog"`, conteúdo é `role="group"`; Tab sai e o popover fica aberto. | Alinhar o papel; fechar no `focusout`. |
| B7 | Baixa | `layout.tsx:28` | `themeColor` fixo #0d1116; no tema claro a barra do navegador destoa. | Duas metas com `media` ou atualizar no `setTheme`. |
| B8 | Baixa | `page.tsx:6` | Título da aba é "Dashboard" (template não vale na mesma raiz); as outras saem "X · Prospecção de Leads". | `title: { absolute: "Dashboard · Prospecção de Leads" }`. |
| B9 | Baixa | `dashboard.tsx:180-184,561-563` | `aria-live` sem a espera de 400 ms e sem "Mapa: {n} empresas." (ux-radar §8); fechar o painel anuncia "36 empresas. Etapa…" sem mudança. | Debounce, texto do mapa, limpar `live` em `closePanel`. |
| B10 | Baixa | `lead-panel.tsx:651` | `outline-none` no h2 que recebe foco programático: sem indicador. | `focus-visible:outline-2`. |
| B11 | Baixa | `radar-map-canvas.tsx:318` | `aria-label` em `div` focável sem `role`; parte dos leitores ignora o nome. | `role="group"`. |
| B12 | Baixa | `radar-map.tsx:75-94` | Em 375 px a legenda aberta cobre ~6 px da atribuição. | Legenda `bottom-8` abaixo de 640 px. |
| B13 | Baixa | `radar-map.tsx:159` | Rótulo do mapa segue "carregando" quando os pontos falham. | Incluir o estado de erro. |
| B14 | Baixa | `lead-list.tsx:196`, `dashboard.tsx:180` | Após Esc, foco na linha (tabindex -1) e o ponto de Tab volta à 1ª linha. | Manter a última linha como tabbable. |
| B15 | Baixa | `dashboard.tsx:560-645` | 1400×900 mostra 6 linhas (spec UX: 9): funil tem 246 px (UX 104; visual 186 + padding). Specs divergem. | Fixar uma altura; enxugar a zona de barra/taxa. |
| B16 | Baixa | `view-state.ts:13`, `lead-list.tsx:199` | 200 por página renderiza 200 linhas sem `content-visibility`. | `content-visibility: auto` na `li`. |
| B17 | Baixa | `dashboard.tsx:129` | Empresa aberta e mapa aberto/fechado não entram na URL. | Opcional: `?empresa=id`. |

## 3. Critérios de aceite da story

| # | Resultado | Evidência |
|---|---|---|
| 1 | Passa | 1400×900: número-herói 36, funil, mapa e 6 linhas; página sem rolagem (B15). |
| 2 | Passa | Clique em "Precisam de site": 196 na lista e no mapa, Panorama muda; 2º clique volta a Encontradas (`?todas=1`); Panorama também filtra e desfaz. |
| 3 | Passa | Pontos por nível e contatadas com anel verde; clique num ponto abriu Yakisoba Ten; tooltip "Yakisoba Ten · Quente 95". |
| 4 | Passa | `role="img"` "Quente, 95 de 100" na linha, no painel e no nome do botão da linha; legenda com rótulos. |
| 5 | Passa | Envio preso à direita em toda linha; verde só com WhatsApp confirmado e não contatada (contatada: "Reenviar" secundário). |
| 6 | **Falha** | Escuro é o padrão em 1º acesso (contexto limpo). Claro: texto de 12 px do funil a 2,37:1 (A1). Demais pares ≥ 5,25:1. |
| 7 | Não verificado por inteiro | Testados: busca, etapas, Panorama, ordem e direção, menu Exportar (hrefs). Não testados: Pesquisas, Agendamentos, Configurações, downloads, "Mais filtros" avançados. |
| 8 | Passa com ressalva | Vistos: lista vazia, mapa sem empresas, Panorama vazio, erro de lista, funil e pontos com "Tentar de novo". Falta erro do Panorama (M6). "Mapa sem internet" não emulável; o código existe (`radar-map.tsx:228-250`). |
| 9 | Passa com ressalva | 375 px sem rolagem horizontal; teclado completo; CSS de movimento reduzido conferido (`globals.css:534-555`). Ressalvas M1, M3, M4, M5. |
| 10 | Parcial | Leaflet (44 kB) só baixa ao abrir o mapa; Chart.js saiu. `lint`, `typecheck`, `test`, `build` não rodados (build proibido nesta auditoria). |
| 11 | **Falha** | 2 achados de gravidade alta (A1, A2). |

## 4. Contrastes medidos (WCAG, texto 4,5:1; não texto e texto grande 3:1)

| Par | Escuro | Claro |
|---|---|---|
| Texto principal (h1) / rua | 16,29 | 15,98 |
| Recorte do título (tinta-2) | 9,15 | 8,24 |
| Nome da empresa / linha | 15,32 | 15,02 |
| Bairro e motivo (tinta-3, 12 px) | 5,97 | 5,25 |
| Rótulo do site (tinta-2) | 8,61 | 7,75 |
| Termômetro: rótulo Quente / score | 11,43 / 15,32 | 5,31 / 15,02 |
| Número-herói (64 px) / KPI (34 px) | 11,43 / 15,32 | 6,22 / 17,61 |
| Funil: rótulo, taxa, link "sem contato" | 5,97 / 5,97 / 8,61 | 6,15 / 6,15 / 9,08 |
| **Funil não selecionado: rótulo e taxa (12 px)** | **2,69** | **2,37** |
| Funil não selecionado: número (34 px) | 5,39 | 3,94 |
| Botão verde (texto) / secundário | 9,60 / 13,45 | 9,60 / 13,93 |
| Placeholder da busca | 6,57 | 5,79 |
| Trilho: inativo / ativo / tema | 9,15 / 13,01 / 9,15 | 8,24 / 13,66 / 8,24 |
| "Ordenar", paginação, `Kbd` | 5,97 / 8,61 / 6,35 | 6,15 / 9,08 / 5,58 |
| Painel: h2, subtítulo, rótulo de bloco | 15,32 / 8,61 / 5,97 | 17,61 / 9,08 / 6,15 |
| Painel: rótulo grande Quente, "/100" | 11,43 / 5,97 | 6,22 / 6,15 |
| Painel: etiqueta Site, sinal, dado-rótulo | 8,79 / 8,61 / 5,97 | 6,22 / 9,08 / 6,15 |
| Painel: Excluir (perigo), etiqueta Contatada | 7,02 / 8,00 | 6,57 / não medido |
| Mapa: legenda, título da legenda, "N pontos" | 7,99 / 5,54 / 5,97 | 9,08 / 6,15 / 6,15 |
| **Mapa: atribuição OSM** | **1,92** (2,21 sobre via) | 5,93 |
| Linha contatada selecionada: rótulo Quente (60%) | 4,20 | não medido |
| "Anterior" desabilitado (isento) | 3,17 | 2,77 |
| Não texto: borda do input / select | 3,33 / 3,34 | 3,52 / 3,61 |
| Não texto: segmento do termômetro | 11,43 | 4,65 |
| Não texto: botão verde (fundo) / com borda | 8,98 | 1,98 / 5,02 |
| Não texto: anel de foco | 8,41 | 6,18 |
| Borda do botão secundário (rótulo identifica) | 1,63 | 1,51 |

## 5. Verificado sem achado

- Tab (38 paradas): passar-ao-conteúdo, trilho, busca, Exportar, Nova pesquisa, 5 etapas, "sem contato", "Limpar etapa", filtros, barra da lista, 1 linha + envio, Por página, "Pular o mapa", mapa (div, OSM, zoom), Recolher, Panorama. Ordem lógica; anel de foco visível em todas.
- Atalhos: J e K (live "Taishi, Quente, 85 de 100, Site antigo. 2 de 36."), Enter (foco na mensagem), E (foco em "Próxima empresa"; live "Proposta aberta no WhatsApp…"), N, C ("Copiado"), M (mantém o foco), `/`, `?`, Esc (fecha o quadro, depois o painel; foco na linha).
- Gaveta a 1024 px: `<dialog>` modal (`:modal`), `aria-label` com o nome da empresa, foco no título, fundo inerte, Esc devolve o foco à linha.
- Nomes acessíveis: botões de ícone têm `aria-label`; funil, Panorama e etapas usam `aria-pressed`; termômetro `role="img"`; inputs com rótulo; `aria-live="polite"`; `href` do envio lido sem clicar (`wa.me/55…?text=…`).
- 375 px: sem rolagem horizontal; o mapa só monta ao abrir. Console: sem erros do app (1 issue, B4).
- Movimento reduzido: anima só `transform`/`opacity`, sem `transition: all`; pulso vira anel estático; Leaflet sem animação.

## 6. Ocorrências durante a auditoria

- O servidor `:3000` passou a responder 500 nos chunks estáticos depois de um novo `.next` (BUILD_ID às 15:49, não gerado por mim). Precisa reiniciar. As medições de contraste e teclado foram feitas antes; os estados vazio/erro, mapa e carga sob demanda, em `:3211`.
- Efeitos colaterais: a tecla E marcou "Taishi" como contatada e desmarquei na hora (funil voltou a 36 prontas e 0 contatadas); C sobrescreveu a área de transferência; o Enter em "Excluir empresa" foi bloqueado pelo ambiente e não repeti.
- O navegador era compartilhado com outro agente: páginas trocaram de seleção e uma das minhas chamadas caiu na página dele (alternei o tema; ao conferir estava escuro).

## 7. Correções de 30/09/2026

Método: medição na tela com Chromium próprio (Playwright) contra o build de produção em `:3211`, nos dois temas a 1400×900 e a 375×812, com os mesmos cálculos da seção 4 (composição de camadas e opacidade). `lint`, `typecheck`, `test` (142 passaram, 18 ignorados) e `build` passam. Nenhum envio real foi feito (o `click()` dos links de envio foi interceptado nos testes de tecla E); a empresa usada para medir a linha contatada foi marcada e desmarcada na hora (funil voltou a 36 prontas e 0 contatadas).

### Gravidade alta e média

| # | Estado | O que mudou | Medição depois |
|---|---|---|---|
| A1 | Corrigido | Opacidade saiu do botão da etapa; só a barra apaga (55 %). Número de etapa vazia passou a `tinta-3` (antes herdava `opacity-45`). | Rótulo e taxa (12 px): 5,97 escuro / 6,15 claro; número 15,32 / 17,61 (vazio: 5,97 / 6,15). Era 2,69 / 2,37. |
| A2 | Corrigido | Seletor `.radar .leaflet-container .leaflet-control-attribution` (especificidade 0,3,0) vence o `leaflet.css`; fundo escuro de 80 para 88 % (margem no pior pixel do mapa). | Escuro: 6,23 sobre o mapa médio e 5,18 sobre o pixel mais claro (era 1,92). Claro: 5,90 e 6,15. |
| M1 | Corrigido | Tamanho real de 44 em ≤ 767 px (`max-md:h-11`/`size-11`; botão novo `touch` para o envio compacto, que perdia para o `h-8`): envio da linha e do painel, Exportar, Nova pesquisa, tema, marca do topo, Filtros, busca, selects e campos, Ordenar e direção, Anterior/Próxima/Fechar, Copiar, Desmarcar, Excluir, zoom, Recentrar, Legenda, Abrir/Recolher, linhas do Panorama, vazamento "sem contato", ícones de contato, "Informar WhatsApp", "Dados". | 375 px, 5 estados (lista, mapa aberto, Panorama aberto, folha de filtros, painel): 0 controles abaixo de 44×44, exceto o link "OpenStreetMap" do crédito (81×14, obrigatório) e o link de pulo, que só aparece no foco. |
| M2 | Corrigido | `rowSendLabel`: "Enviar proposta para {nome} no WhatsApp (abre em nova aba)", "Tentar WhatsApp para {nome}, celular|telefone fixo (…)", "Enviar e-mail para {nome}", "Reenviar proposta para {nome} …"; também "Adicionar WhatsApp de {nome}". Começa pelo texto visível (2.5.3). | 36 links, 36 nomes únicos. |
| M3 | Corrigido | Campos do painel marcam `data-dirty` (mensagem editada, observação não salva, número não salvo). Esc em campo sem pendência fecha o painel; com pendência, o 1º Esc leva o foco ao título e o 2º fecha. Na gaveta o mesmo (o `preventDefault` do keydown impede o `<dialog>` de fechar sozinho). | Desktop 1400 e gaveta 1024: 1º Esc mantém aberto com foco em `h2#painel-empresa-titulo`, 2º fecha e o foco volta à linha; sem edição, fecha de uma vez. |
| M4 | Corrigido | Abrir/Recolher mapa passa o foco ao botão do outro estado; Excluir leva o foco à confirmação (grupo nomeado) e Cancelar devolve o foco a "Excluir empresa"; Desmarcar leva o foco ao botão de envio do painel. Anúncios: "Mapa recolhido." / "Mapa aberto.", "Empresa excluída: {nome}.", "Contato desmarcado: {nome}.". | Foco e texto do `aria-live` conferidos nos quatro casos (a exclusão só até a confirmação; não confirmei). |
| M5 | Corrigido | Chave "Atalhos de teclado" no quadro do `?` (ligada por padrão, em `localStorage["radar:atalhos"]`); desligada, J K E N C M / ? não respondem (Esc segue valendo). E exige empresa selecionada e foco em `#lista-empresas` ou `[data-lead-panel]`. | E com foco no corpo, em campo ou sem seleção: não envia; com foco na linha: dispara (interceptado). Desligado: M e J não fazem nada; lembrado ao recarregar. |
| M6 | Corrigido | Panorama recebe `error` e `onRetry`: `ErrorState` com "Tentar de novo"; o esqueleto ganhou `role="status"` e texto "Carregando o panorama…". | `/api/stats` com 500 simulado: mostra o erro; ao voltar, "Tentar de novo" recupera. |
| M7 | Corrigido | `aria-label` "Recolher mapa", "Recolher/Abrir panorama", "Atalhos de teclado"; `Kbd` ganhou `decorative` (`aria-hidden`) nos botões; a tecla segue em `aria-keyshortcuts`. | Nomes lidos por `getByRole(..., { exact: true })`. |
| M8 | Corrigido | `Thermometer dim`: só os segmentos a 80 %; rótulo e score em `tinta-2`, sem opacidade. | Rótulo "Quente": 8,61 (linha) e 6,71 (selecionada) no escuro; 9,08 e 7,73 no claro (era 4,20). Segmentos: 7,67 / 6,26 escuro, 3,71 / 3,31 claro. |

### Gravidade baixa

| # | Estado | Nota |
|---|---|---|
| B1 | Corrigido | `outline-2 outline-transparent` no lugar de `outline-none` (campos e menu Exportar): em alto contraste o contorno aparece. |
| B2 | Corrigido | `touch-action: manipulation` e `-webkit-tap-highlight-color: transparent` na base. |
| B3 | Corrigido | `overscroll-contain` no corpo do modal, no painel, na folha de filtros, na lista (desk) e no Panorama. |
| B4 | Corrigido | `id`/`name` em "Por página"; `name` em "Ordenar" e nos selects de filtro. Nenhum select/input sem `id` ou `name`. |
| B5 | Corrigido | `?` foca o quadro (`tabIndex=-1`); `?` de novo fecha e devolve o foco ao botão. |
| B6 | Corrigido | `aria-haspopup="dialog"` só no celular (folha); no desktop `aria-controls="mais-filtros"`; Tab para fora fecha o popover. |
| B7 | Corrigido | `ThemeToggle` ajusta `meta[name=theme-color]` (#0d1116 / #f2f4f7) ao hidratar e ao alternar. O primeiro quadro, antes da hidratação, ainda usa a cor escura. |
| B8 | Corrigido | `title: { absolute: "Dashboard · Prospecção de Leads" }`. |
| B9 | Corrigido | Anúncio espera 400 ms; filtro e etapa acrescentam "Mapa: {n} empresas."; fechar o painel limpa o texto. |
| B10 | Corrigido | Título do painel sem `outline-none`: anel visível (2 px) depois do Esc. |
| B11 | Corrigido | `role="group"` no contêiner do mapa. |
| B12 | Corrigido | Legenda aberta sobe (`max-sm:bottom-8`) e deixa o crédito livre em 375 px. |
| B13 | Corrigido | Rótulo do mapa: "Mapa das empresas, não consegui carregar os pontos". |
| B14 | Corrigido | A última linha fechada com Esc continua sendo o único ponto de Tab. |
| B15 | Não feito | As duas especificações divergem (9 linhas na UX, funil de 186 px no visual); escolher qual vale é decisão de design, não de acessibilidade. |
| B16 | Não feito | `content-visibility: auto` impõe `contain: paint` na linha e pode cortar o anel de foco; só importa com 200 por página. Medir antes. |
| B17 | Não feito | Opcional: `?empresa=id` muda o contrato da URL e o `view-state.ts`. |

### Critérios de aceite depois das correções

| # | Resultado |
|---|---|
| 6 | Passa (funil claro ≥ 6,15; demais pares da seção 4 inalterados). |
| 8 | Passa, com o erro do Panorama visto; "Mapa sem internet" continua sem emulação. |
| 9 | Passa (M1, M3, M4, M5 corrigidos). |
| 10 | Passa: `lint`, `typecheck`, `test`, `build`. |
| 11 | Passa: sem pendência de gravidade alta. |
| 7 | Sem mudança: Pesquisas, Agendamentos, Configurações e "Mais filtros" avançados seguem sem teste completo. |

### Restos e observações

- **Atalhos em tela pequena:** o botão "Atalhos" (e com ele a chave) só existe a partir de 768 px; em celular com teclado físico os atalhos de tecla única seguem ligados e sem chave.
- **Chip de filtro:** o × mede 20 com área de 32 (passa 2.5.8, não o alvo de 44).
- **Ruído só do `next dev`:** `Cannot read properties of undefined (reading 'save')` (canvas do Leaflet com o StrictMode remontando o mapa). Não ocorre no build de produção (0 erros ao abrir, recolher e reabrir o mapa); não mexi.
- **Servidor `:3000`:** o `npm run build` renovou a pasta `.next`; o servidor do usuário precisa ser reiniciado.

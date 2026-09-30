# Sistema visual "Radar noturno" (fase A2, story 1.5)

Especificação para implementação direta. Direção e regras vêm do brief da story 1.5; aqui estão só valores. Tema próprio registrado em `docs/design/tema-radar-noturno.md`. Nome do app: "Prospecção de Leads". Sem emoji, sem marca de agência, sem biblioteca além do Leaflet (já em `package.json`, ^1.9.4).

Decisões estruturais: escuro é o padrão e vive em `:root` (sem flash no primeiro acesso); o claro é `:root.light`; a classe `.dark` continua válida. O alternador grava `light` ou `dark` em `<html>`. Profundidade: degraus de superfície + anel de 1 px (escuro); anel + sombra em camadas (claro). Matiz das superfícies: 218° nos dois temas.

## 1. Tokens de cor

### 1.1 Onde cada cor pode e não pode aparecer

| Cor | Pode | Não pode |
|---|---|---|
| Âmbar `letreiro` | Segmentos e ponto do termômetro, pontos do mapa, número-herói, etiquetas Sem site / Só rede social / Site antigo, monograma de empresa Quente, ponto (blip) da marca, barra "selecionado" nas distribuições | Links, navegação, foco, botões, títulos, gráficos genéricos, fundo de bloco, ícones decorativos. Brilho (`letreiro-halo`, `text-shadow`) só em nível 5 e no número-herói |
| Verde `envio` | Botão de envio (um por linha), etiqueta "Contatado", anel do ponto contatado no mapa, barra da etapa "Contatadas" do funil | Navegação, foco, "Copiado" e outros sucessos (usam `tinta-2` + CheckIcon), toggles, links |
| Vermelho `pino` | Site fora do ar, erro de requisição ou de campo, botão perigo | Decoração, mapa, qualquer estado que não seja problema |
| Névoa `nevoa` | Site moderno, barras neutras, níveis 1 e 2 do termômetro, estados inativos | Ação |

Regra por linha da tabela: no máximo um elemento verde. Linha não contatada: botão verde. Linha contatada: etiqueta verde "Contatado" e o botão vira secundário "Enviar de novo". Sem WhatsApp confirmado (celular ou fixo) ou só e-mail: botão secundário, nunca verde. Distribuição alvo 60/30/10: 60 % `rua` + `calcada`; 30 % `muro`, `vitrine`, fios, texto e névoa; 10 % acentos (âmbar até 7 %, verde até 2 %, vermelho até 1 %). Âmbar e verde nunca ficam lado a lado em tamanho comparável: o verde é sempre pequeno (botão sm, etiqueta, anel de 2 px).

### 1.2 Tokens (colar em `globals.css`)

```css
:root, :root.dark {
  color-scheme: dark;
  /* superfícies: matiz 218°, sat. 26 %, luminosidade 7 / 10 / 13 / 17 % */
  --rua: #0D1116; --calcada: #131820; --muro: #191F2A; --vitrine: #202837;
  --realce: rgba(255,255,255,.05); --realce-forte: rgba(255,255,255,.09); --scrim: rgba(4,6,10,.62);
  /* texto */
  --tinta-1: #EBEEF4; --tinta-2: #ACB5C3; --tinta-3: #8D96A5; --tinta-4: #606876;
  /* fios */
  --fio-suave: rgba(255,255,255,.05); --fio: rgba(255,255,255,.08); --fio-forte: rgba(255,255,255,.16); --fio-foco: #8DB4F0;
  /* letreiro (âmbar) */
  --letreiro: #F5A623; --letreiro-brilho: #FFC65A; --letreiro-texto: #F5A623; --numero-heroi: #FFC65A;
  --letreiro-suave: rgba(245,166,35,.14); --letreiro-halo: rgba(245,166,35,.55);
  /* envio (verde) */
  --envio: #25D366; --envio-hover: #3BE07F; --envio-ativo: #1FB85A; --envio-borda: transparent;
  --sobre-envio: #04130A; --envio-texto: #3DDC84; --envio-suave: rgba(37,211,102,.12);
  /* pino (vermelho) e névoa */
  --pino: #F2625B; --pino-texto: #FF7A73; --pino-suave: rgba(242,98,91,.14);
  --pino-solido: #C8342E; --pino-solido-hover: #D6403A; --pino-solido-ativo: #B12B26; --sobre-pino: #FFFFFF;
  --nevoa: #6F7A8A;
  /* termômetro, do nível 5 ao 1 */
  --termo-5: #FFC65A; --termo-4: #F5A623; --termo-3: #B9802A; --termo-2: #8B7A5C; --termo-1: #6F7A8A; --termo-vazio: rgba(255,255,255,.10);
  /* controles */
  --ctl-bg: #090C10; --ctl-borda: rgba(255,255,255,.36); --ctl-borda-hover: rgba(255,255,255,.52); --ctl-anel: rgba(141,180,240,.28);
  --primario: #EBEEF4; --primario-hover: #D0D3D9; --primario-ativo: #BEC3CB; --sobre-primario: #0D1116;
  --desab-bg: rgba(255,255,255,.05);
  /* profundidade: anel, sem sombra projetada */
  --elev-1: 0 0 0 1px var(--fio); --elev-2: 0 0 0 1px var(--fio-forte); --elev-3: 0 0 0 1px var(--fio-forte);
  /* mapa */
  --mapa-filtro: grayscale(1) invert(1) sepia(1) hue-rotate(178deg) saturate(1.8) brightness(.8);
  --mapa-mistura: screen; --mapa-ponto-anel: none; --glow-heroi: 0 0 24px var(--letreiro-halo);
}
:root.light {
  color-scheme: light;
  --rua: #F2F4F7; --calcada: #FFFFFF; --muro: #FFFFFF; --vitrine: #FFFFFF;
  --realce: rgba(18,25,38,.04); --realce-forte: rgba(18,25,38,.08); --scrim: rgba(18,25,38,.36);
  --tinta-1: #121926; --tinta-2: #3F495A; --tinta-3: #586274; --tinta-4: #949CA8;
  --fio-suave: rgba(18,25,38,.06); --fio: rgba(18,25,38,.10); --fio-forte: rgba(18,25,38,.20); --fio-foco: #2050B8;
  --letreiro: #C47100; --letreiro-brilho: #E8930C; --letreiro-texto: #8F5200; --numero-heroi: #8F5200;
  --letreiro-suave: rgba(232,147,12,.14); --letreiro-halo: rgba(196,113,0,.30);
  --envio-hover: #3BE07F; --envio-ativo: #1FB85A; --envio-borda: #12803D; --envio-texto: #0B6B31; --envio-suave: rgba(37,211,102,.14);
  --pino: #E5484D; --pino-texto: #B42318; --pino-suave: rgba(229,72,77,.10); --nevoa: #6B7686;
  --termo-5: #A35500; --termo-4: #C47100; --termo-3: #A9853F; --termo-2: #8B7A5C; --termo-1: #6B7686; --termo-vazio: rgba(18,25,38,.10);
  --ctl-bg: #F7F8FA; --ctl-borda: rgba(18,25,38,.52); --ctl-borda-hover: rgba(18,25,38,.68); --ctl-anel: rgba(32,80,184,.22);
  --primario: #121926; --primario-hover: #2A3345; --primario-ativo: #3F495A; --sobre-primario: #FFFFFF;
  --desab-bg: rgba(18,25,38,.05);
  --elev-1: 0 0 0 1px rgba(18,25,38,.08), 0 1px 2px -1px rgba(18,25,38,.08), 0 2px 4px rgba(18,25,38,.04);
  --elev-2: 0 0 0 1px rgba(18,25,38,.10), 0 2px 4px -1px rgba(18,25,38,.08), 0 8px 16px -4px rgba(18,25,38,.12);
  --elev-3: 0 0 0 1px rgba(18,25,38,.12), 0 4px 8px -2px rgba(18,25,38,.10), 0 16px 32px -8px rgba(18,25,38,.18);
  --mapa-filtro: grayscale(.8) contrast(.94) brightness(1.03);
  --mapa-mistura: normal; --mapa-ponto-anel: 0 0 0 1.5px #FFFFFF, 0 0 0 2.5px rgba(18,25,38,.55); --glow-heroi: none;
}
@theme inline {
  --color-canvas: var(--rua); --color-surface: var(--calcada); --color-surface-2: var(--muro); --color-surface-3: var(--vitrine);
  --color-hover: var(--realce); --color-selected: var(--realce-forte);
  --color-line: var(--fio); --color-line-soft: var(--fio-suave); --color-line-strong: var(--fio-forte); --color-focus: var(--fio-foco);
  --color-fg: var(--tinta-1); --color-muted: var(--tinta-2); --color-subtle: var(--tinta-3); --color-faint: var(--tinta-4);
  --color-accent: var(--letreiro-texto); --color-warn: var(--letreiro-texto); --color-amber: var(--letreiro); --color-amber-glow: var(--letreiro-brilho);
  --color-send: var(--envio); --color-send-fg: var(--sobre-envio); --color-sent: var(--envio-texto);
  --color-danger: var(--pino-texto); --color-pin: var(--pino); --color-fog: var(--nevoa);
  --color-control: var(--ctl-bg); --color-control-line: var(--ctl-borda);
  --radius-badge: 4px; --radius-control: 6px; --radius-card: 10px; --radius-panel: 14px;
  --shadow-elev-1: var(--elev-1); --shadow-elev-2: var(--elev-2); --shadow-elev-3: var(--elev-3);
  --font-sans: var(--f-texto), ui-sans-serif, system-ui, sans-serif; --font-display: var(--f-display), ui-sans-serif, system-ui, sans-serif;
}
```

Migração dos nomes atuais: `accent` passa a ser texto âmbar (`letreiro-texto`); fundo âmbar é `bg-amber`; `bg-accent` dos botões some (vira `bg-send` ou `bg-[var(--primario)]`). `warn` é alias do âmbar e só pinta ícone e filete esquerdo de aviso; o parágrafo do aviso usa `text-muted`. Controles usam `background-clip: padding-box` para a borda translúcida compor sobre a superfície-mãe, e não sobre o fundo inset.

### 1.3 Contraste WCAG calculado (pior superfície: `vitrine` no escuro, `rua` no claro)

| Par | Escuro | Claro | Uso |
|---|---|---|---|
| tinta-1 / superfície | 12,72 | 15,98 | texto principal |
| tinta-2 / superfície | 7,15 | 8,24 | corpo secundário |
| tinta-3 / superfície | 4,96 | 5,58 | metadado, placeholder, rótulo de seção. Sobre `realce-forte` só em `rua` e `calcada` (4,65 / 5,25); em `muro` e `vitrine` use `tinta-2` |
| tinta-4 / calçada | 2,63 | 2,51 | só desabilitado (isento) |
| letreiro-texto / superfície | 7,30 | 5,65 | texto âmbar |
| número-herói / superfície (texto grande) | 9,49 | 5,65 | número-herói |
| envio-texto / superfície | 8,29 | 6,03 | "Contatado" |
| pino-texto / superfície | 5,83 | 5,97 | erro, perigo |
| sobre-envio / envio (hover 11,02; ativo 7,31) | 9,60 | 9,60 | texto do botão verde |
| sobre-primário / primário (hover; ativo) | 16,29 (12,63; 10,69) | 17,61 (12,67; 9,08) | botão neutro |
| sobre-pino / pino-sólido (hover; ativo) | 5,27 (4,51; 6,48) | 5,27 (4,51; 6,48) | perigo sólido |
| tinta-1 / realce-forte (botão secundário, linha selecionada) | 9,67 (vitrine) | 13,57 (rua) | secundário, seleção |
| tinta-1 / pino-suave | 12,95 | 14,14 | mensagem do estado de erro |
| tinta-3 / fundo translúcido da atribuição | 6,35 | 6,04 | crédito do OSM |
| etiqueta âmbar / pino / envio sobre o próprio tom | 5,57 / 4,91 / 6,54 | 5,05 / 5,28 / 5,47 | etiquetas |
| fio-foco / superfície (3:1) | 6,98 | 6,57 | anel de foco |
| ctl-borda / superfície (3:1) | 3,20 | 3,50 | input, select, checkbox |
| termo-5 a termo-1 / superfície (3:1) | 9,49 / 7,30 / 4,35 / 3,55 / 3,40 | 4,94 / 3,34 / 3,12 / 3,78 / 4,18 | segmentos |
| envio-borda / calçada (3:1) | n/a | 5,02 | contorno do botão verde no claro (o fundo verde tem 1,80) |

Pontos do mapa, nível 5 a 1 sobre o terreno filtrado (escuro): 12,26 / 9,42 / 5,62 / 4,58 / 4,39; sobre a água, o nível 1 cai a 2,90, aceito porque cor não é o único canal (tamanho e opacidade variam, e a lista repete o nível em texto). No claro, o anel duplo (`--mapa-ponto-anel`) garante o contraste.

## 2. Tipografia

Títulos e números: **Barlow Semi Condensed** (500, 600, 700): condensada de placa de sinalização, dá peso de letreiro ao número-herói e caixa alta de rótulo. Texto: **Schibsted Grotesk** (variável, 400 a 700): grotesca de jornal, x-height alto, boa em 12 a 14 px com acentos em português. As duas têm `tnum` (verificado nas tabelas GSUB das fontes) e estão em `next/font/google`. Substitui Inter.

```ts
const display = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["500","600","700"], variable: "--f-display", display: "swap" });
const texto = Schibsted_Grotesk({ subsets: ["latin"], variable: "--f-texto", display: "swap" });
// <html className={`${display.variable} ${texto.variable}`}>; body: font-sans, 14px/21px
```

Escala: razão 1,25 sobre 14 px (14; 17,5; 21,9; 27,3; 34,2; 66,7), arredondada à grade de 4 px onde é título. A legenda sobe de 11 para 12 px por legibilidade. Hierarquia por peso e cor antes de tamanho: nome 600 `tinta-1`, categoria 400 `tinta-2`, metadado 400 `tinta-3`, todos a 14/12 px. Números sempre `font-variant-numeric: tabular-nums lining-nums`. Títulos com `text-wrap: balance`; corpo com `text-wrap: pretty`; `-webkit-font-smoothing: antialiased`.

| Papel | Família | Tamanho / linha | Peso | Tracking | Cor |
|---|---|---|---|---|---|
| Número-herói (Prontas para abordar) | Display | 64 / 64 | 700 | -0,02em | `numero-heroi`; `text-shadow: var(--glow-heroi)` |
| Número de etapa do funil, KPI | Display | 34 / 36 | 600 | -0,01em | `tinta-1` |
| h1 (título de página) | Display | 28 / 32 | 600 | -0,01em | `tinta-1` |
| h2 (painel, drawer, diálogo) | Display | 18 / 24 | 600 | 0 | `tinta-1` |
| Rótulo de seção e cabeçalho de tabela | Display | 12 / 16, caixa alta | 600 | +0,08em | `tinta-3` |
| Corpo | Texto | 14 / 21 | 400 | 0 | `tinta-1` (secundário `tinta-2`) |
| Corpo forte (nome da empresa) | Texto | 14 / 20 | 600 | 0 | `tinta-1` |
| Legenda | Texto | 12 / 16 | 400 | +0,01em | `tinta-3` (`tinta-2` se crítica) |
| Número de tabela (nota, score) | Display | 15 / 20 | 600 | 0 | `tinta-1` |
| Botão | Texto | sm 13 / 16, md 14 / 16 | 600 | 0 | conforme variante |
| Etiqueta | Texto | 12 / 16 | 500 | +0,01em | conforme situação |
| Atribuição do mapa (exceção legal) | Texto | 11 / 14 | 400 | 0 | `tinta-3` |

## 3. Espaço, raio, profundidade

Unidade 4 px. Escala: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56 (2 e 6 só dentro de componentes).

| Medida | px |
|---|---|
| Linha de tabela (min-height; padding 8 12) | 52 |
| Cabeçalho de tabela | 32 |
| Painel e cartão (padding) | 16; painel do funil 16 20 |
| Drawer e diálogo (padding) | 20 |
| Espaço entre painéis / entre seções | 12 / 24 |
| Margem de página | 24 (desktop), 16 (< 640) |
| Barra lateral / cabeçalho de marca | 224 / 56 |
| Input, botão md / botão sm, ícone-botão / chip / etiqueta | 36 / 32 / 28 / 20 |

Raios: 4 etiqueta e segmento grande do termômetro; 6 controle (botão, input, item de menu, barra do funil); 10 cartão, menu, legenda e zoom do mapa; 14 painel, mapa, tabela, diálogo; 999 chip, ponto, trilho de progresso. Regra concêntrica: filho = pai − padding (mínimo 4). Menu 10 com padding 4 leva item de 6; painel 14 com anel interno de 4 leva cartão de 10.

Degraus (uma estratégia por tema):

| Nível | Escuro (degrau + anel 1 px) | Claro (anel + sombra em camadas) | Usos |
|---|---|---|---|
| 0 `rua` | `#0D1116`, sem anel | `#F2F4F7` | página, barra lateral (só fio à direita), cabeçalho, fundo do mapa |
| 1 `calcada` | `#131820`, `--elev-1` | `#FFFFFF`, `--elev-1` | painéis, tabela, funil, cartões |
| 2 `muro` | `#191F2A`, `--elev-2` | `#FFFFFF`, `--elev-2` | drawer, legenda e zoom do mapa |
| 3 `vitrine` | `#202837`, `--elev-3` | `#FFFFFF`, `--elev-3` | diálogo, menu suspenso, tooltip |
| hover / selecionado | `realce` / `realce-forte` sobre o degrau | idem | linha, item de menu, botão secundário |

Controles são inset: `ctl-bg` mais escuro que o pai (escuro) ou `#F7F8FA` (claro).

## 4. Componentes

Foco visível em tudo: `outline: 2px solid var(--fio-foco); outline-offset: 2px`. Hit area mínima 32 px (estende com `::after` quando o visual é menor). Transições listadas na seção 5.

### 4.1 Botões

Comum: raio 6; sm h 32, padding 0 12, gap 6, 13/16; md h 36, padding 0 14, gap 8, 14/16; peso 600; ícone 16. Ativo: `scale(.97)`. Carregando: spinner de 14 px no lugar do ícone, texto mantido, `aria-busy`, `pointer-events: none`. Desabilitado (todas as variantes exceto fantasma): fundo `desab-bg`, texto `tinta-4`, borda `fio-suave`, `cursor: not-allowed`, sem hover nem escala.

| Variante | Padrão (fundo / texto / borda) | Hover | Ativo |
|---|---|---|---|
| Envio (verde) | `envio` / `sobre-envio` / `envio-borda` | `envio-hover` | `envio-ativo` |
| Primário neutro | `primario` / `sobre-primario` / transparente | `primario-hover` | `primario-ativo` |
| Secundário | `realce` / `tinta-1` / `fio-forte` | `realce-forte` | `realce-forte`, borda `ctl-borda` |
| Fantasma | transparente / `tinta-2` / transparente | `realce`, texto `tinta-1` | `realce-forte` |
| Perigo (contorno) | transparente / `pino-texto` / `pino` a 45 % | `pino-suave` | `pino-suave`, borda `pino` |
| Perigo sólido (confirmar) | `pino-solido` / `sobre-pino` / transparente | `pino-solido-hover` | `pino-solido-ativo` |

### 4.2 Campos

Input, select, textarea: h 36 (textarea min 160, padding 10 12, line-height 20), padding 0 12, raio 6, fundo `ctl-bg`, borda 1 px `ctl-borda`, `background-clip: padding-box`, texto 14 `tinta-1`, placeholder `tinta-3`. Select: `appearance: none` + ChevronDown 16 `tinta-3` à direita, padding-right 32. Hover: borda `ctl-borda-hover`. Foco: borda `fio-foco` + `box-shadow: 0 0 0 3px var(--ctl-anel)` (sem outline). Inválido: borda `pino`, mensagem 12/16 `pino-texto` com AlertIcon 14. Desabilitado: fundo transparente, borda `fio`, texto `tinta-4`. Carregando: spinner 14 px à direita, `aria-busy`. Rótulo 12/16 500 `tinta-2`, margem 6 abaixo; dica 12/16 `tinta-3`, margem 4 acima.

Checkbox: 16 × 16, raio 4, borda `ctl-borda`, fundo `ctl-bg`; marcado: fundo `tinta-1`, CheckIcon 12 `rua` (neutro, nunca âmbar nem verde); hover: borda `ctl-borda-hover`; foco: outline padrão; desabilitado: borda `fio`, marca `tinta-4`. Área clicável: o rótulo inteiro, altura 32.

### 4.3 Etiquetas (h 20, padding 0 6, raio 4, 12/16 500, gap 4, marca de 8 px à esquerda)

| Situação | Fundo | Texto | Anel inset 1 px | Marca (forma, para não depender só de cor) |
|---|---|---|---|---|
| NONE Sem site | `letreiro-suave` | `letreiro-texto` | âmbar 35 % | círculo cheio |
| SOCIAL_ONLY Só rede social | âmbar 8 % | `letreiro-texto` | âmbar 25 % | meio círculo |
| OLD Site antigo | transparente | `letreiro-texto` | âmbar 40 % | círculo vazado |
| UNREACHABLE Site fora do ar | `pino-suave` | `pino-texto` | `pino` 35 % | losango |
| OK Site moderno | transparente | `tinta-2` | `fio-forte` | círculo vazado `nevoa` |
| UNKNOWN Não analisado | transparente | `tinta-3` | `fio-forte` tracejado | sem marca |
| Contatado | `envio-suave` | `envio-texto` | `envio` 30 % | CheckIcon 12 |

### 4.4 Termômetro de oportunidade

Barra de 5 segmentos, horizontal, preenchidos da esquerda. Vazio: `termo-vazio`. O rótulo e o número são sempre visíveis (texto visível com `aria-hidden`); o contêiner leva `role="img"` e `aria-label="Quente, 95 de 100"`. Sem nota: 5 vazios + "Não analisada".

| Estrelas | Rótulo | Segmentos | Cor do preenchimento | Brilho (só escuro) | Rótulo em |
|---|---|---|---|---|---|
| 5 | Quente | 5 | `termo-5` | `0 0 6px var(--letreiro-halo)` por segmento preenchido | `letreiro-brilho` |
| 4 | Aquecida | 4 | `termo-4` | nenhum | `letreiro-texto` |
| 3 | Morna | 3 | `termo-3` | nenhum | `tinta-2` |
| 2 | Fria | 2 | `termo-2` | nenhum | `tinta-3` |
| 1 | Gelada | 1 | `termo-1` | nenhum | `tinta-3` |

Compacto (tabela): segmento 6 × 4, raio 1, gap 2 (trilho de 38 px); depois gap 8, rótulo 12/16 500, gap 6, score Display 13/16 600 (`tinta-1`). Grande (drawer): segmento 26 × 8, raio 2, gap 3 (trilho de 142 px), brilho do nível 5 `0 0 10px`; à esquerda o score em Display 34/36 `tinta-1` mais "/100" 12 `tinta-3`; à direita o rótulo em Display 18/24 600 e o trilho abaixo. No claro não há brilho: o nível 5 se distingue por `termo-5` (mais escuro) e pelo rótulo.

### 4.5 Funil de prospecção

Painel `calcada`, raio 14, padding 16 20, título no rótulo de seção e, à direita, fantasma sm "Limpar etapa" quando há seleção. Forma: funil deitado, barras centradas num eixo comum, afinando da esquerda para a direita, ligadas por conectores trapezoidais. Não são cinco caixas iguais.

- Grade: `grid-template-columns: 1fr 20px 1fr 20px 1fr 20px 1.7fr 20px 1fr` (colunas de 20 px são os conectores). Cada etapa é um `<button aria-pressed>` com quatro linhas fixas: rótulo 16 (rótulo de seção), 64 (número, alinhado embaixo), 72 (zona da barra), 16 (taxa), com 6 de espaço entre elas; altura total 186.
- Altura da barra: `h = 16 + 56 × (valor / encontradas)` px, centrada na zona de 72; valor 0 vira linha tracejada de 2 px. Conector: polígono SVG de 20 px cujos lados acompanham as alturas vizinhas, fundo `realce`, sem traço.
- Números: 34/36 nas etapas comuns; "Prontas para abordar" é o herói: 64/64 (seção 2), coluna 1,7 vezes mais larga.
- Barras (raio 6): comum `realce-forte` + anel `fio`; herói `letreiro-suave` + anel âmbar 55 % + `box-shadow: 0 0 28px -4px rgba(245,166,35,.40)` (escuro; no claro sem brilho e anel `letreiro`); Contatadas `envio-suave` + anel `envio` 40 %.
- Taxa (12/16, `tinta-3`; herói `tinta-2`): etapa ÷ anterior, "86% da anterior". Contatadas = contatadas ÷ (contatadas + prontas), "x% já abordadas". Sem inteiros quebrados; 0 < x < 0,5 mostra "< 1%"; anterior zero mostra "-". A primeira etapa mostra "total".
- Hover: anel da barra `fio-forte` (herói: halo a 55 %). Selecionada: anel de 1,5 px `tinta-1` (herói: `letreiro-brilho`), demais etapas a 55 % de opacidade, 160 ms. Foco: outline padrão com offset 4 no botão. Valor 0: `aria-disabled`, opacidade .45. Carregando: cinco barras de esqueleto com as alturas 72, 64, 44, 28, 20.
- Abaixo de 768 px: lista vertical; cada etapa é uma linha 44 px (rótulo à esquerda, número à direita) com barra de 6 px e largura `valor / encontradas`; o herói tem 64/64 e barra de 10 px âmbar.

### 4.6 Mapa-radar

Contêiner: raio 14, `--elev-1`, `overflow: hidden`, altura 360 (desktop) / 280 (< 768), `.leaflet-container { background: var(--rua); font-family: inherit }`. Zoom inicial ajustado aos pontos (`fitBounds`, padding 32).

Tiles: `.leaflet-tile-pane { filter: var(--mapa-filtro) }`. Escuro: inverte o mapa claro do OSM e tinge na matiz 218°; resultado calculado: terreno `#0C1016` (≈ `rua`), água `#283447`, prédios `#232D3E`, contorno de ruas `#34445D`, vias principais `#44597A`, ruas (miolo branco) quase pretas; rótulos saem claros. Claro: dessatura e abaixa o contraste para os pontos dominarem. Valores vêm de simulação das matrizes do filtro: conferir na tela antes de fechar.

Pontos (Ø em px; `divIcon` circular; escuro / claro mudam só a cor):

| Nível | Ø | Preenchimento (escuro / claro) | Opacidade | Brilho (escuro) |
|---|---|---|---|---|
| 5 Quente | 14 | `termo-5` | 1 | `0 0 0 3px rgba(245,166,35,.22), 0 0 14px 3px var(--letreiro-halo)` |
| 4 Aquecida | 10 | `termo-4` | .92 | `0 0 8px 1px rgba(245,166,35,.32)` |
| 3 Morna | 8 | `termo-3` | .75 | nenhum |
| 2 Fria | 6 | `termo-2` | .55 | nenhum |
| 1 Gelada | 5 | `termo-1` | .40 | nenhum |
| Contatada | 10 | fundo `envio-suave`, borda 2 px `envio` (claro `envio-texto`), ponto central 3 px | 1 | nenhum |
| Selecionada | Ø do nível × 1,4 | igual ao nível | 1 | `0 0 0 2px var(--rua), 0 0 0 4px var(--tinta-1)` + pulso |

No claro todo ponto leva `box-shadow: var(--mapa-ponto-anel)` e o nível 5 ganha halo `0 0 0 3px rgba(163,85,0,.18)`. Com mais de 600 pontos use `L.canvas()` com `circleMarker`: halo é um segundo círculo de raio + 4 e `fillOpacity .16`; só o selecionado vira `divIcon` (o pulso é CSS). Maior score fica por cima (`zIndexOffset = score`).

Agrupamento sem biblioteca: o painel de marcadores usa `mix-blend-mode: var(--mapa-mistura)` (escuro: `screen`, onde pontos sobrepostos somam luz e formam manchas mais claras; claro: `normal`). Além disso, por zoom:

| Zoom | Escala do Ø | Brilho | Opacidade |
|---|---|---|---|
| 14 ou mais | 1,0 | níveis 5 e 4 | tabela |
| 12 a 13 | 0,8 | níveis 5 e 4 | tabela |
| 10 a 11 | 0,6 (mín. 4 px) | só nível 5 | tabela − .10 |
| 9 ou menos | 0,4 (mín. 3 px) | só nível 5 | níveis 1 a 3 a .30 |

Controles: zoom no topo à direita, 12 px da borda: grupo de 2 botões 32 × 32, raio 10, fundo `muro`, `--elev-2`, divisor `fio`, ícone Plus/Minus 16 `tinta-2`; hover `realce-forte` e `tinta-1`; limite de zoom: `tinta-4` e sem hover. Legenda embaixo à esquerda, 12 px da borda: `muro`, `--elev-2`, raio 10, padding 8 10, uma linha: título "Oportunidade" (rótulo de seção 11/14 `tinta-3`), cinco amostras em Ø real + rótulo 12/16 `tinta-2` (gap 10), divisor, amostra "Contatada". Abaixo de 640 px, só um botão "Legenda" (secundário sm) que abre a mesma lista. Atribuição embaixo à direita, colada à borda: fundo `rgba(13,17,22,.80)` (claro `rgba(255,255,255,.85)`), padding 2 8, raio 6 no canto superior esquerdo, texto "© OpenStreetMap contributors" (link para `https://www.openstreetmap.org/copyright`, `tinta-3`, hover `tinta-1` sublinhado, foco padrão); abaixo de 640 px, "© OpenStreetMap". Prefixo "Leaflet" removido (`setPrefix(false)`).

Estados: carregando, fundo `rua` + spinner 16 e "Carregando o mapa" 12/16 `tinta-3`; sem pontos, cartão central (`muro`, `--elev-2`, raio 10, padding 16, largura 280): RadarVazio 64 px (anéis `fio-forte`), "Nenhuma empresa neste filtro" 14/20 600, "Tire um filtro para ver pontos." 12/16 `tinta-3`, fantasma sm "Limpar filtros"; sem internet, faixa no topo (h 32, `muro`, `fio` embaixo) com WifiOffIcon 16 `tinta-2` e "Sem conexão com o mapa. Os pontos e a lista continuam funcionando." 12/16 `tinta-2`, fundo plano `rua`.

### 4.7 Linha de tabela

Tabela num painel (`calcada`, raio 14, `--elev-1`); cabeçalho sticky h 32 (`calcada`, borda inferior `fio`, rótulo de seção; ordenável ativo `tinta-1` + chevron 14). Colunas: Empresa 300, Oportunidade 196, Site 168, Nota 88, Contato 116, Proposta 172 (presa à direita, mesmo fundo da linha, `box-shadow: -1px 0 0 var(--fio)`). Linha: min-height 52, padding 8 12, borda inferior `fio-suave`; hover `realce`; selecionada `realce-forte` + `inset 2px 0 0 var(--tinta-2)` na primeira célula; foco no nome com outline padrão.

- Empresa: monograma 32 × 32, raio 8, gap 12, Display 13/16 600, +0,02em, duas iniciais (ignora de, da, do, e; uma palavra usa as duas primeiras letras). Cor: nível 5 fundo `letreiro-suave` e letra `letreiro-texto`; demais fundo `realce-forte` e letra `tinta-2`. Ao lado, nome 14/20 600 `tinta-1` (hover sublinhado 1 px) e, abaixo, "categoria · bairro, cidade/UF" 12/16 `tinta-2`, truncado.
- Oportunidade: termômetro compacto e, abaixo, o motivo (`scoreReasons[0]`) 12/16 `tinta-3`, uma linha.
- Site: etiqueta e, abaixo, plataforma ou host 12/16 `tinta-3`. Nota: Display 15/20 600 + "(n)" 12 `tinta-3`. Contato: botões-ícone 28 × 28 (hit 32), ícone 16 `tinta-2`, hover `tinta-1` + `realce`.
- Proposta: botão verde sm "Enviar proposta" (regra da seção 1.1). Linha contatada: nome `tinta-2`, termômetro a 60 % de opacidade, etiqueta "Contatado" acima do botão secundário "Enviar de novo".

### 4.8 Casca e marca

Barra lateral: 224, fundo `rua`, borda direita `fio`. Bloco da marca h 56, padding 0 16: glifo 24 + gap 10 + "Prospecção de Leads" Display 18/20 600 `tinta-1`. Item de menu h 36, padding 0 10, raio 6, gap 10, ícone 16, 14/20 500 `tinta-2`; hover `realce` e `tinta-1`; ativo `realce-forte`, `tinta-1`, peso 600 (sem âmbar). Rodapé: alternador de tema (fantasma md, SunIcon/MoonIcon + "Tema claro/escuro"). Abaixo de 1024 px: barra superior h 48 (marca + botão de menu) e a navegação abre como drawer à esquerda de 280. Cabeçalho de página: h1, descrição 14/21 `tinta-2` (máx. 60ch) e ações à direita (Exportar secundário md, Nova pesquisa primário neutro md), margem inferior 20.

Glifo (viewBox 24, traço 1,5, `round`, centro x 12 y 12): círculo de raio 10,25 em `tinta-3`; círculo de raio 5,5 em `tinta-3` a 70 %; linha de varredura do centro até x 18,5 y 5,5 em `tinta-1`, traço 1,75; blip em cx 16,5 cy 15,5, raio 2, preenchido `letreiro`, com `drop-shadow(0 0 3px var(--letreiro-halo))` só no escuro. Mesmo desenho no favicon.

### 4.9 Overlays, filtros e estados

| Componente | Especificação |
|---|---|
| Drawer | `min(480px, 100vw)`, fundo `muro`, borda esquerda `fio-forte` (claro `--elev-2`), scrim `--scrim` sem blur. Cabeçalho h 64: monograma 40 (raio 10), nome h2, categoria 12 `tinta-2`, fechar (fantasma, 32). Corpo padding 20, seções separadas por 20 e fio `fio-suave`, sem cartões internos; textarea usa `ctl-bg`. Rodapé sticky, padding 16 20, borda superior `fio`, botão verde md |
| Diálogo | largura `min(440px, 100vw - 32px)`, `vitrine`, raio 14, anel `fio-forte` (claro `--elev-3`), padding 20, título h2, corpo 14/21 `tinta-2`, rodapé com botões à direita, gap 8; `<dialog>` nativo, Esc fecha |
| Menu suspenso | min 200, `vitrine`, raio 10, anel `fio-forte`, padding 4; item h 32, padding 0 10, raio 6, 14/20 `tinta-2`, ícone 16; hover `realce` + `tinta-1`; ativo por teclado `realce-forte` + anel interno 2 px `fio-foco`; divisor `fio-suave` com margem 4 |
| Chip de filtro ativo | h 28, padding 0 4 0 10, pílula, fundo `realce`, anel `fio-forte`; "Chave:" 13/16 `tinta-3` + valor 13/16 500 `tinta-1`; botão × 20 × 20 (ícone 12, `tinta-3`, hover `tinta-1` + `realce-forte`); "Limpar tudo" fantasma sm |
| Paginação | esquerda "1 a 20 de 214" 13/16 `tinta-2`; direita select sm, dois botões-ícone 32 (secundário) e "Página 2 de 11" 13/16 `tinta-2` |
| Distribuição (barra fina) | linha h 28, padding 4 8, raio 6, botão de filtro; rótulo 13/16 `tinta-2` (35 %, trunca) + trilho h 6, pílula, `realce-forte` + contagem Display 13/16 600 `tinta-1`, à direita, 40 px. Preenchimento `nevoa`; hover `tinta-2`; filtro ativo `letreiro`, demais a 50 %. Situação do site usa as cores da etiqueta (Sem site `letreiro`, Só rede social a 70 %, Antigo a 45 %, Fora do ar `pino`, Moderno `nevoa`, Não analisado `nevoa` a 40 %) |
| Progresso de pesquisa | trilho h 6, pílula, `realce-forte`; preenchimento `tinta-1` (concluída `tinta-2` + CheckIcon 14, pausada `tinta-3`, falhou `pino`); em fila: segmento de 30 % que corre. Rótulo acima: "34 de 500 empresas" 12/16 `tinta-2` e percentual Display 13/16 à direita |
| Esqueleto | fundo `realce-forte`, raio 4, pulso de opacidade; linha de tabela: monograma 32 + barras 160 × 12 e 100 × 10 + trilho 38 × 4; nunca forma âmbar |
| Estado vazio | padding 40 16, borda 1 px tracejada `fio-forte`, raio 14, RadarVazio 96 (anéis r 44, 30, 16 em `fio-forte`, ponto `tinta-4`), título Display 18/24 600, texto 14/21 `tinta-2` (máx. 40ch), botão primário neutro |
| Estado de erro | `role="alert"`, fundo `pino-suave`, anel 1 px `pino` a 35 %, raio 10, padding 12 16, AlertIcon 16 `pino-texto`, mensagem 14/21 `tinta-1`, "Tentar de novo" secundário sm |

## 5. Movimento

Curvas: `--ease-saida: cubic-bezier(.23, 1, .32, 1)` (entradas e interação); `--ease-mov: cubic-bezier(.77, 0, .175, 1)` (movimento na tela). Nunca `transition: all` nem ease-in; só `transform` e `opacity` se movem; cor e fundo transitam por propriedade nomeada.

| Tipo | Duração / curva | O que anima |
|---|---|---|
| Hover, foco | 120 ms, saída | cor, fundo, borda, `box-shadow` |
| Press | 100 ms, saída | `scale(.97)` |
| Menu, popover | 160 ms entra, 100 ms sai, saída | opacidade + `scale(.96)` para `scale(1)`, origem no gatilho |
| Drawer | 260 ms entra, 180 ms sai, saída | `translateX(24px)` para `translateX(0)` + opacidade; scrim 200 ms |
| Diálogo | 200 ms entra, 120 ms sai, saída | opacidade + `scale(.96)` para `scale(1)`, centrado |
| Entrada de lista | 180 ms, saída, atraso 30 ms por linha (máx. 10 linhas) | opacidade + `translateY(4px)` para `translateY(0)`; só na 1ª carga e na troca de página |
| Funil ao filtrar | 320 ms, mov | `scaleY` das barras (texto não escala), opacidade das etapas |
| Pontos do mapa | 200 ms, saída | opacidade ao entrar |
| Voo do mapa | `flyTo` 450 ms | zoom/centro ao selecionar empresa |
| Pulso do selecionado | 2,4 s, saída, infinito | `::after` anel 2 px `letreiro-brilho` (claro `letreiro`), `scale(1)` para `scale(2.6)`, opacidade .5 para 0 |
| Esqueleto | 1,4 s, ease-in-out, infinito | opacidade .55 a 1 |
| Progresso em fila / spinner | 1,4 s linear / 800 ms linear | `translateX` / `rotate` |

```css
:root { --ease-saida: cubic-bezier(.23, 1, .32, 1); --ease-mov: cubic-bezier(.77, 0, .175, 1); }
@keyframes radar-pulso { from { transform: scale(1); opacity: .5 } to { transform: scale(2.6); opacity: 0 } }
@keyframes respira { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes fila { from { transform: translateX(-100%) } to { transform: translateX(340%) } } /* segmento de 30 % */
@keyframes gira { to { transform: rotate(360deg) } }
.ponto-sel::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--letreiro-brilho);
  animation: radar-pulso 2.4s var(--ease-saida) infinite; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-property: opacity, background-color, border-color, color !important; transition-duration: 120ms !important; }
  .ponto-sel::after { animation: none; transform: scale(1.8); opacity: .4; }
  .esqueleto, .spinner { animation: respira 1.4s ease-in-out infinite !important; }
  .progresso-fila { animation: none !important; transform: none; width: 40%; }
}
```

Brilho dos pontos quentes: estático (nível 5 não pulsa); só o selecionado pulsa. `prefers-reduced-motion: reduce`: sem `transform` animado (drawer, menu, diálogo e lista só mudam opacidade em 120 ms), pulso vira anel estático (`scale(1.8)`, opacidade .4), `flyTo` com `animate: false`, esqueleto e spinner trocam rotação por pulso de opacidade, progresso em fila vira barra parada a 40 %. Substitui a regra global atual (`animation-duration: .01ms` em tudo) por uma que mantém a transição de opacidade.

## 6. Ícones

Traço 1,75, `round`, viewBox 24, `currentColor`, sem preenchimento (mantém o componente `Svg` de `icons.tsx`). Tamanhos: 14 (etiqueta, chip, inline), 16 (botão, menu, nav, campo), 20 (cabeçalho mobile, ação isolada), 64 a 96 (ilustração de estado vazio, traço 1,5). Cor herdada do texto; nenhum ícone usa âmbar exceto o blip da marca.

Novos: `RadarIcon` (glifo da marca, 4.8), `RadarVazio` (anéis concêntricos sem blip), `CheckIcon` (`m5 12.5 4.5 4.5L19 7.5`), `MinusIcon` (`M5 12h14`), `SpinnerIcon` (arco de 270°, r 8), `MapIcon`, `ListIcon` (alternar mapa e lista no mobile), `LocateIcon` (mira: círculo r 7 + 4 marcas; centraliza no ponto selecionado), `WifiOffIcon`. Sai de uso: `StarIcon` (substituída pelo termômetro) e `ChartIcon` (não há mais gráficos).

## Testes da interface-design

1. Troca: trocar Barlow por Inter apaga a caixa alta de placa e o número-herói vira número de dashboard comum; trocar o funil por seis cartões tira o herói do lugar. Passa, e o ponto mais fraco é o fundo escuro com âmbar (comum em painéis): o que o separa é o mapa-radar e o termômetro.
2. Olhos semicerrados: sobra o número âmbar do funil, a mancha de pontos no mapa e o botão verde da coluna direita; o resto é estrutura de 3 degraus quase iguais. Passa.
3. Assinatura (5 pontos): número-herói âmbar do funil; termômetro de 5 segmentos na linha e no drawer; pontos com brilho e pulso do selecionado no mapa; marca radar com blip âmbar; botão verde único por linha com anel verde para contatadas. Passa.
4. Tokens: `--rua`, `--calcada`, `--muro`, `--vitrine`, `--tinta-N`, `--fio`, `--letreiro`, `--envio`, `--pino`, `--nevoa`, `--termo-N` só fazem sentido numa ferramenta de prospecção de rua à noite. Passa.

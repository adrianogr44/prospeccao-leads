# Sistema de interface: "Radar noturno"

Fonte dos valores: `docs/design/visual-radar.md` (tokens) e `docs/design/ux-radar.md` (layout). Implementação: `src/app/globals.css` e `src/components/ui.tsx` (fonte única de estilo de controle).

## Direção

- **Quem:** o Adriano, de manhã, escolhendo 20 a 50 empresas locais para abordar no dia.
- **Verbo:** escolher a próxima empresa e enviar a proposta. Foco: a fila "Prontas para abordar" e o botão de envio da linha.
- **Sensação:** radar de rua à noite. Cidade escura (asfalto azul-grafite), oportunidades quentes em âmbar de letreiro, verde de WhatsApp só no envio. Denso como ferramenta, não arejado como site.
- **Assinaturas:** número-herói âmbar do funil; termômetro de 5 segmentos (linha, painel, legenda); mapa-radar com pontos que brilham e pulso no selecionado; marca radar com blip âmbar; um só verde por linha.
- **Tema:** escuro é o padrão (`:root`); claro é `:root.light` (classe gravada pelo script sem flash e pelo alternador; `localStorage.theme` = `light` | `dark`).

## Cor (onde cada uma pode aparecer)

| Token | Uso | Nunca |
|---|---|---|
| `--rua` / `--calcada` / `--muro` / `--vitrine` (matiz 218°) | página / painel / gaveta, legenda / diálogo, menu | cor de outra matiz em superfície |
| `--tinta-1..4` | texto principal / secundário / metadado / desabilitado | |
| `--letreiro` (âmbar) | termômetro, pontos, número-herói, etiquetas Sem site / Só rede social / Antigo, monograma Quente, blip da marca, barra ativa da distribuição | links, foco, botões, títulos |
| `--envio` (verde) | botão de envio (um por linha), etiqueta Contatada, anel da contatada (monograma e mapa), barra Contatadas | navegação, sucesso genérico (use `tinta-2` + CheckIcon) |
| `--pino` (vermelho) | site fora do ar, erro, perigo | decoração |
| `--nevoa` | site moderno, barras neutras, níveis 1 e 2 | ação |

Classes Tailwind: `bg-canvas surface surface-2 surface-3`, `text-fg muted subtle faint`, `text-accent` (âmbar texto), `bg-amber`, `bg-send`, `text-sent`, `text-danger`, `bg-pin`, `bg-fog`, `bg-control`, `border-control-line`, `border-line(-soft|-strong)`.

## Profundidade

Uma estratégia por tema. Escuro: degraus de superfície (7 / 10 / 13 / 17 % de luminosidade) + anel de 1 px (`--elev-1` = `fio`, `--elev-2/3` = `fio-forte`), sem sombra projetada. Claro: anel + sombra em camadas (`--elev-1..3`). Controles são inset (`--ctl-bg` mais escuro que o pai) com `background-clip: padding-box`.

## Espaço e raio

- Unidade 4 px. Escala 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56 (2 e 6 só dentro de componentes).
- Margem de página 24 (16 abaixo de 640). Vão entre painéis 12; entre colunas do dashboard 24.
- Raios: `rounded-badge` 4 · `rounded-control` 6 · `rounded-card` 10 · `rounded-panel` 14 · pílula 999. Concêntrico: filho = pai − padding.

## Tipografia

- Display: **Barlow Semi Condensed** 500/600/700 (`font-display`, variável `--f-display`). Texto: **Schibsted Grotesk** (`font-sans`, `--f-texto`).
- Escala 1,25 sobre 14 (tokens `text-*`): `heroi` 64/64 · `kpi` 34/36 · `h1` 28/32 · `h2` 18/24 · `corpo` 14/21 · `forte` 14/20 · `numero` 15/20 · `botao` 13/16 · `botao-md` 14/16 · `legenda` 12/16 · `mini` 11/14.
- Rótulo de seção: utilitário `rotulo` (Display 12/16, caixa alta, +0,08em, `tinta-3`).
- Hierarquia por peso e cor antes de tamanho: nome 600 `tinta-1`, categoria 400 `tinta-2`, metadado 400 `tinta-3`.
- Números: `tabular-nums` só em elementos numéricos (o `tnum` alarga vírgulas no texto corrido; por isso não fica no `body`).

## Movimento

`--ease-saida` cubic-bezier(.23,1,.32,1) para entradas e interação; `--ease-mov` para movimento na tela. Utilitários `transicao` (cor, fundo, borda, sombra 120 ms; transform 100 ms) e `pressiona` (`scale(.97)`). Gaveta 260 ms (`anima-gaveta`), folha inferior (`anima-folha`), diálogo 200 ms, menu 160 ms, linha 180 ms com atraso de 30 ms (máx. 10). `prefers-reduced-motion`: só opacidade em 120 ms, pulso vira anel estático, esqueleto e spinner pulsam.

## Padrões de componente (medidas)

| Componente | Medidas |
|---|---|
| Botão sm / md | h 32 / 36 · padding 0 12 / 0 14 · gap 6 / 8 · 13/16 e 14/16 · 600 · raio 6 · ícone 16. Variantes: `send`, `primary` (neutro), `secondary`, `ghost`, `danger`, `danger-solid`. `loading` troca o ícone por spinner 14 |
| Botão-ícone | 28 (hit 32 via `alvo`), 32, 36, 44 (celular) |
| Input / select / textarea | h 36 · padding 0 12 (select com seta 16 a 10 px da direita, padding-right 32) · raio 6 · foco: borda `fio-foco` + anel 3 px `ctl-anel`; textarea min 160, padding 10 12, linha 20 |
| Etiqueta | h 20 · padding 0 6 · raio 4 · 12/16 500 · marca de 8 px por situação (círculo cheio, meio círculo, vazado, losango) |
| Chip de filtro | h 28 · pílula · padding 0 4 0 10 · "Chave:" `tinta-3` + valor 500 `tinta-1` · × 20 × 20 |
| Termômetro compacto | segmentos 6 × 4, raio 1, gap 2 (trilho 38) · gap 8 · rótulo 12/16 500 · gap 6 · score Display 13/16 600. `role="img"` "Quente, 95 de 100" |
| Termômetro grande | segmentos 26 × 8, raio 2, gap 3 (142) · score Display 34/36 + "/100" 12 · rótulo Display 18/24 |
| Níveis | 5 Quente, 4 Aquecida, 3 Morna, 2 Fria, 1 Gelada (cor `--termo-N`; brilho só no 5, só no escuro) |
| Monograma | 40 × 40 raio 10 na lista e no painel (32 × 32 raio 8 disponível) · Display 13/16 600 · Quente: `letreiro-suave` + âmbar; contatada: anel interno 2 px `--envio-anel` |
| Linha da lista | 64 (72 no celular) · monograma 40 · gap 12 · colunas 40 / 1fr / termômetro 128 / ação 152 presa à direita · hover `realce`, selecionada `realce-forte` + filete 2 px `tinta-2` |
| Funil | painel padding 16 20 · grade `1fr 20 1fr 20 1fr 20 1.7fr 20 1fr` · etapa = 4 linhas 16 / 64 / 72 / 16, gap 6 · barra `16 + 56 × valor/encontradas` · conector SVG 20 px · herói 64/64 âmbar com brilho · celular: herói + chips de 120 que rolam |
| Distribuição | linha h 28 · rótulo 35 % · trilho h 6 pílula · contagem Display 13/16 em 40 px · ativa âmbar, demais a 50 % |
| Mapa-radar | card raio 14 · 320 (≥ 1280) / 240 · rodapé 36 com "{n} pontos" e Recolher (M) · zoom 2 × 32 × 32 raio 10 (`muro`) · legenda `muro` raio 10 padding 8 10 · atribuição 11/14 no canto |
| Painel da empresa | navegação 44 · cabeçalho monograma 40 + h2 · corpo padding 20, blocos separados por 20 e `fio-suave` · barra de envio fixa padding 12 20 |
| Gaveta / folha | `min(480px, 100vw)` à direita (tela cheia < 768) · folha inferior 80 dvh raio 14 no topo |
| Diálogo | `min(440px, 100vw − 32px)` · `vitrine` · raio 14 · padding 20 |
| Menu suspenso | min 200 · `vitrine` · raio 10 · padding 4 · item h 32 padding 0 10 raio 6 · foco por teclado `realce-forte` + anel interno 2 px `fio-foco` |
| Estado vazio | padding 40 16 · borda tracejada `fio-forte` · raio 14 · RadarVazio 96 · título Display 18/24 · texto 14/21 `tinta-2` (40ch) |
| Estado de erro | `role="alert"` · `pino-suave` + anel `pino` 35 % · raio 10 · padding 12 16 · "Tentar de novo" secundário sm |
| Cartão de item (`cardStyles`) | raio 10 · `calcada` + `--elev-1` · padding 16 · `raised` (item em andamento) sobe para `--elev-2` · recebe foco por código (`tabIndex -1`) quando acabou de ser criado |
| Painel de formulário | `panelClass` · padding 20 · grade de 6 colunas (`formGridClass`, vão 12 × 16): categoria, fonte e palavras-chave 6 · cidade 4 + UF 2 · raio 3 + limite 3 |
| Aviso (`Notice`) | `realce` + anel `fio` · raio 10 · padding 8 12 · filete âmbar de 2 px à esquerda · ícone `warn` 16 · texto `tinta-2` |
| Barra de progresso | trilho h 6 pílula `realce-forte` · legenda 12/16 `tinta-2` à esquerda e percentual Display 13/16 à direita · preenchimento `tinta-1` (pausada `tinta-3`, falhou `pino`) move por `translateX` · em fila: segmento de 30 % (`progresso-fila`), 40 % parado com movimento reduzido |
| Chave (`Switch`) | h 36 · trilho 36 × 20 pílula, bola 16 · ligada `primario` com bola `sobre-primario`, desligada `ctl-bg` + anel `ctl-borda` · texto do estado 13/16 500 ao lado · nunca verde nem âmbar |
| Caixa de seleção (`Checkbox`) | 16 × 16 raio 4 · marcada `primario` + CheckIcon 12 · rótulo inteiro clicável, h mín. 32 |
| Casca | trilho 88 (marca 56, itens 72 × 56 com ícone 20 + rótulo Display 12) · celular: barra superior 48 + abas inferiores 56 |

## Layout do Dashboard

- ≥ 1280 e ≥ 760 de altura (`desk:`): página não rola; lista 1fr | vão 24 | lateral `clamp(400px, 32vw, 480px)` (mapa em cima, painel ou Panorama embaixo). Lista, painel e Panorama rolam por dentro.
- ≥ 1280 com pouca altura: a página rola e a lateral fica `sticky`.
- 768 a 1279: uma coluna (funil, filtros, mapa recolhível, Panorama recolhível, lista); painel em gaveta modal.
- < 768: herói do funil, busca + "Filtros" (folha inferior), linha de 72 com botão de 44; painel em tela cheia.
- Todo contêiner com `overflow` leva `relative` (os textos `sr-only` absolutos das linhas não podem escapar para a página).

## Layout de Pesquisas, Agendamentos e Configurações

Rótulo de seção (`Section`, h2 `rotulo`, h 32) acima de cada coluna, alinhado no topo; a página rola (sem coluna fixa por altura).

- **Pesquisas** (≥ 1024): formulário 360 à esquerda, histórico `1fr` à direita, vão 24. Abaixo de 1024: uma coluna, formulário recolhível ("Recolher / Abrir", aberto ao entrar, recolhe depois de criar) e largura máxima de 512. Pesquisa em andamento ou na fila fixa no topo. Cartão: título 14/20 600 + etiqueta de situação (neutra com ícone; vermelha só em falha), linha de metadados 12/16 `tinta-3`, barra de progresso (não aparece em concluída), números em Display 15/20 (`Encontradas`, `Novas`, `Atualizadas`, `Consultas`) e ações à direita.
- **Agendamentos** (≥ 1024): lista `1fr` à esquerda (aviso em faixa no topo), formulário 360 à direita. Abaixo de 1024: lista primeiro; "Novo agendamento" no rótulo da lista abre o formulário abaixo e leva o foco ao primeiro campo. Cartão: título + chave Ativo/Desativado, "Próxima: {data}" em Display 18/24 (inativo: "Desativado" em `tinta-3`), frequência e última execução em 12/16, Excluir com confirmação em linha.
- **Configurações** (≥ 1280): formulário 640 + vão 24 + prévia de 420 (`sticky`, top 24, altura máx. `100dvh − 112`, a mensagem rola por dentro). Abaixo de 1280: uma coluna e a prévia abre numa folha inferior pelo botão "Prévia". Barra de ações `sticky` no pé (Salvar `primary`, Restaurar padrão `ghost`, estado à direita; em celular fica acima das abas). Depois da primeira tentativa de salvar, os erros acompanham o que se digita e o foco vai ao primeiro campo com erro.

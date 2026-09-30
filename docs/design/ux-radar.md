# UX "Radar noturno": arquitetura da informação e layout (Story 1.5, fase A1)

Escopo: hierarquia, posição, proporção, densidade e comportamento. Cor, fonte e estilo ficam em `visual-radar.md` (A2). Todo dado vem de `src/lib/contract.ts`. Base real usada nos exemplos: 214 restaurantes de Campinas, 196 precisam de site, 36 têm contato e ainda não foram abordados, 0 contatados, 100% com coordenada, 12 com WhatsApp confirmado.

## 1. Princípios

1. **Uma pergunta por tela.** O Dashboard responde "quem eu abordo agora?": fila e botão de envio dominam; funil, mapa e distribuições são apoio.
2. **O mesmo clique filtra e desfaz.** Funil, barras, pontos do mapa e chips escrevem os mesmos filtros na URL; nada filtra por um caminho que o resto da tela não mostre.
3. **Trabalho em série sem voltar à lista.** O painel fica ao lado da lista (não por cima); "Próxima", J/K e E levam à empresa seguinte; o foco acompanha a ação.
4. **Densidade de ferramenta.** Linha de 64 px, 9 linhas na primeira dobra; dado ausente some em vez de virar "—".
5. **Nada só por cor ou só por mouse.** Termômetro sempre com rótulo e número; cada ação do mapa tem equivalente na lista; tudo por teclado.

## 2. Dashboard

**Ponto focal:** a fila "Prontas para abordar" (lista) e o botão de envio da linha. **Ordem de leitura:** 1) número-herói no funil, 2) primeiras linhas da lista, 3) botão de envio, 4) mapa, 5) filtros e distribuições. **Estado inicial** (qualquer URL sem `needsSite`, `hasContact`, `contacted` e `todas`): etapa Prontas ativa (`needsSite=yes&hasContact=yes&contacted=no`), ordenada por Oportunidade decrescente. A etapa Encontradas grava o parâmetro de interface `todas=1` para o "sem filtro" não voltar ao padrão ao recarregar (não é parâmetro de API).

### 2.1 Desktop 1400 px (≥ 1280: painel fixo, cada coluna rola por dentro, a página não rola)

```
 rail 88 │ LISTA 792 (1fr, rola por dentro)                    │ vão 24 │ LATERAL 448 (fixa)
┌──────┬──────────────────────────────────────────────────────────────────────────────────────────┐
│  PL  │  Dashboard · restaurante/Campinas    [Buscar… /]   [Exportar v] [+ Nova pesquisa]        │
│      ├──────────────────────────────────────────────────────────┬───────────────────────────────┤
│ Dash │  FUNIL (104)                                             │  MAPA-RADAR 448x320  [+][-][c]│
│ Pesq │ Encontr.   Precisam   Com contato  ╔═══════════╗  Contat.│   .    o    *    .    o       │
│ Agen │   214   >    196   >     36     >  ║    36     ║ >   0   │     .   *@   .   o   .        │
│ Conf │          160 sem contato           ║ PRONTAS   ║         │   o    .    *    .   *        │
│      │                                    ╚═══════════╝         │  Quente Morna Fria Contatada  │
│      │  [Cidade v][Categoria v][Site v][Mais filtros]           │  36 pontos    Recolher (M)    │
│      │  (chips dos filtros ativos)            Limpar tudo       ├───────────────────────────────┤
│      ├──────────────────────────────────────────────────────────┤  PANORAMA (sem empresa aberta)│
│      │  36 empresas   Ordenar [Oportunidade v][↓]  Atalhos ?    │  Termômetro  Q 7  M 29  F 0   │
│      │  [YT] Yakisoba Ten  Jd Guanabara [#####] Quente 95       │  Situação do site             │
│      │       Sem versão p/ celular      [WA Tentar WhatsApp]    │   Sem site      ==========29  │
│ Tema │  [TB] Taishi  Jd Chapadão        [#####] Quente 85       │   Fora do ar    == 5          │
│      │       Direitos autorais de 2017   [WA Enviar proposta]   │  Cidades e Categorias (2+)    │
│      │  ... 9 linhas de 64 px visíveis, a lista rola            │  Empresa aberta: o Panorama   │
│      ├──────────────────────────────────────────────────────────┤  vira o painel (seção 3)      │
│      │  1–36 de 36  Por página [50 v]  [< Anterior] [Próxima >] │                               │
└──────┴──────────────────────────────────────────────────────────┴───────────────────────────────┘
```

- **Larguras:** trilho 88; preenchimento 24; lista = restante (792 em 1400; 710 em 1280); lateral `clamp(400px, 32vw, 480px)` (448 em 1400); vão 24. A lista é maior porque é o foco; a lateral é estreita porque mapa e painel cabem em 448.
- **Alturas em 900 px:** topo 56; funil 104; filtros 44 (+32 se houver chips); barra da lista 32; rodapé de paginação 44 (fixo); sobra ≈ 590 para 9 linhas. Com janela abaixo de 760 px de altura a página passa a rolar e funil e filtros rolam junto. Lateral: mapa 320 + vão 12 + região inferior ≈ 512.
- **O que fica fixo:** trilho, topo, funil, filtros, barra da lista, paginação, mapa, barra de envio do painel. **O que rola:** as linhas da lista e o conteúdo do painel/Panorama.
- **Mapa recolhível** (botão "Recolher" ou tecla M): vira barra de 40 px e a região inferior ganha a altura toda. A escolha é lembrada no navegador (conveniência; a tela funciona sem isso). Padrão: aberto em desktop, fechado em tablet e celular.
- **Topo:** título pequeno (nível terciário) com o recorte quando só há uma cidade e uma categoria ("restaurante em Campinas"); busca livre (`q`) com `/` para focar; "Exportar" (secundário) e "Nova pesquisa" (secundário, deixa de ser o botão mais forte da tela). O menu mantém Excel, CSV, JSON e "Google Sheets…" (diálogo atual), exporta o filtro atual e abre com a linha "Exporta as {n} empresas do filtro atual". O desenho acima não tem escala vertical.
- **Trilho:** logotipo em monograma no topo; Dashboard, Pesquisas, Agendamentos, Configurações com ícone e o rótulo completo embaixo (sempre visível; 88 px é o mínimo que comporta "Configurações"; no desenho os rótulos estão abreviados); alternador de tema no rodapé. Abaixo de 768 px vira barra inferior de 56 px com as mesmas quatro abas.

### 2.2 Tablet 768 a 1279 px

Uma coluna: topo, funil (mesma linha de cinco etapas, 100% da largura), filtros, mapa recolhido (abre com 240 px de altura, largura total), "Panorama" recolhido logo abaixo (mesmas barras da seção 2.8), lista com a mesma linha (nome ganha o espaço extra), paginação no fim da página (a página rola). O painel abre como gaveta modal à direita de 440 px, com Próxima/Anterior e atalhos funcionando dentro dela; a linha selecionada é mantida visível atrás.

### 2.3 Celular 375 px

```
┌─────────────────────────────────────┐
│ Dashboard                 [+] [Exp.]│ 48
├─────────────────────────────────────┤
│ 36                                  │ herói 88; toque = etapa Prontas
│ prontas para abordar                │
│ [Encontr. 214][Precisam 196][Com    │ 4 chips de 120 rolam na horizontal
│  contato 36][Contatadas 0]          │ (+ link "160 sem contato")
├─────────────────────────────────────┤
│ [Buscar empresa…         ] [Filtros]│ 44
│ (chips dos filtros ativos)   Limpar │ rolam na horizontal
├─────────────────────────────────────┤
│ > Mapa · 36 pontos         (fechado)│ 44; abre com 240 e só então carrega
│ > Panorama                 (fechado)│ 44; mesmas barras da seção 2.8
├─────────────────────────────────────┤
│ 36 empresas    Ordenar: [Oport. v]  │ 40
│ [YT] Yakisoba Ten              [WA] │ linha 72; botão 44x44 à direita
│      [#####] Quente 95 · Site antigo│ (nome da empresa no aria-label)
│ [TB] Taishi                    [WA] │
│      [#####] Quente 85 · Site antigo│
│ ...                                 │
│ 1–36 de 36        [< Ant.] [Próx. >]│ botões de 44
├─────────────────────────────────────┤
│  Dash    Pesq.    Agend.    Config. │ 56
└─────────────────────────────────────┘
```

- "Filtros" abre folha inferior (80% da altura) com Cidade, Categoria, Situação do site e os avançados; rodapé fixo "Ver {n} empresas" e "Limpar".
- O toque na linha abre o painel em tela cheia (seção 3); o botão da direita envia sem abrir o painel.
- "Nova pesquisa" vira ícone + no topo, ao lado de Exportar.

### 2.4 Funil: etapas clicáveis

Cinco botões (`aria-pressed`) em uma linha: larguras 116 | 116 | 116 | 268 (herói) | 116 e vão de 15. O herói é a única etapa com rótulo por extenso e número maior que todos os outros; cada etapa tem uma barra fina com largura proporcional a `count / found` (mínimo 3 px, para o zero continuar visível). As setas ligam as etapas em ordem; Contatadas é ramo de Precisam de site (o contrato não a faz subconjunto de Prontas).

| Etapa (valor do `funnel`) | Filtros que grava | Remove |
|---|---|---|
| Encontradas (`found`) | `todas=1` | `needsSite`, `hasContact`, `contacted` |
| Precisam de site (`needsSite`) | `needsSite=yes` | `hasContact`, `contacted` |
| Com contato (`reachable`) | `needsSite=yes`, `hasContact=yes` | `contacted` |
| **Prontas para abordar** (`ready`) | `needsSite=yes`, `hasContact=yes`, `contacted=no` | `todas` |
| Contatadas (`contacted`) | `needsSite=yes`, `contacted=yes` | `hasContact` |

- Clicar na etapa ativa a desfaz (vai para Encontradas). Sempre volta à página 1.
- **O funil não encolhe com a própria seleção:** ele usa os filtros-base (todos menos `needsSite`, `hasContact` e `contacted`), via segunda chamada a `/api/stats` (sem etapa ativa, reaproveita a mesma resposta). Lista, mapa e Panorama usam todos os filtros.
- **Vazamento:** entre Precisam de site e Com contato aparece o link "160 sem contato" (= `needsSite − reachable`; só se > 0). Grava `needsSite=yes&hasContact=no` e vira dois chips. É a fila de trabalho para achar o WhatsApp à mão (campo "WhatsApp da empresa" do painel).
- Combinação que não bate com nenhuma etapa (ex.: Contatado = sim sem `needsSite`): nenhuma etapa fica ativa e os filtros aparecem como chips.

### 2.5 Filtros

- **Barra (44 px, sempre visível):** Cidade, Categoria, Situação do site, "Mais filtros (n)". Cidade e Categoria só aparecem com 2 ou mais opções em `meta`; com uma só, o valor vai para o subtítulo do topo. A busca livre está no topo.
- **Mais filtros:** popover de 480 px (folha inferior no celular), grade de 2 colunas: Estado, **Tem site** (Sim/Não; `hasSite`, que hoje só existe nos cartões que saem), Tem WhatsApp, Tem Instagram, Contatado, Oportunidade mínima (5 segmentos do termômetro, `minStars`), Nota mínima, Avaliações mín. e máx., Pesquisa de origem. Aplica na hora (campos numéricos com 250 ms de atraso, como hoje). O botão mostra o total de avançados ativos e nunca fica desabilitado.
- **Chips de filtro ativo** (linha de 32 px, só existe quando há filtro): um chip por filtro, texto `Rótulo: valor`, botão × com nome acessível "Remover filtro {rótulo}: {valor}"; no fim, "Limpar tudo" (volta a Encontradas, `todas=1`). Filtros de etapa reconhecida ficam no funil, sem chip.
- Qualquer mudança: página 1, atualiza lista, mapa, Panorama, funil e exportação, e anuncia o novo total (seção 8).

### 2.6 Lista: o que aparece em cada linha (64 px, 792 de largura)

```
[Mono 40] Nome da empresa  bairro                   [####.] Morna 75   [ WA Enviar proposta ]
          o Sem site · Sem site cadastrado no OpenStreetMap (confirmar)        (152, preso à direita)
```

| Elemento | Regra |
|---|---|
| Monograma 40 | Iniciais; empresa contatada ganha a marca "contatada" (mesma do mapa) |
| Linha 1 | Nome (peso alto, 1 linha, corta com reticências) + bairro (terciário; sem bairro, cidade; cidade só aparece quando `meta.cities` tem 2 ou mais) |
| Linha 2 | Situação do site (ponto + rótulo de `SITE_STATUS_LABEL`) + primeiro `scoreReasons` diferente do rótulo + nota e avaliações só se existirem (`4,5 (120)`). Contatada: troca o motivo por "Contatada em 30/09" |
| Termômetro 128 | 5 segmentos = `stars`, rótulo (Quente = 5, Morna = 3 e 4, Fria = 1 e 2) e `score`; nome acessível "Quente, 85 de 100" |
| Ação 152 | Botão de proposta, sempre visível e preso à direita; única cor verde da linha. Preenchido só com WhatsApp confirmado ("Enviar proposta"); "Tentar WhatsApp" e "Enviar e-mail" em contorno, como hoje. Sem contato: "Adicionar WhatsApp" (abre o painel com o campo em foco). Contatada: botão vira secundário, "Reenviar" |
| Linha inteira | Clicar (fora do botão) seleciona e abre o painel; hover acende o ponto no mapa |

Colunas: **ficam** Oportunidade (termômetro), Empresa, Proposta. **Fundem** Local → linha 1, Site → linha 2, Nota → linha 2, Motivo → linha 2. **Saem** Contato (ícones ligar, e-mail, Instagram e WhatsApp sem mensagem passam para o bloco "Para" do painel, seção 3). Desaparecem o cabeçalho de tabela fixo e a rolagem horizontal.

- **Ordenação:** a barra da lista tem "Ordenar" (Oportunidade, Nome, Cidade, Categoria, Nota, Avaliações, Atualização; 7 campos de `LEAD_SORT_FIELDS`) e um botão de direção com nome "Ordem decrescente/crescente". Padrão Oportunidade ↓; ao trocar de campo vale `defaultDir`. J/K seguem essa ordem.
- **Paginação:** rodapé fixo com "1–36 de 36" (aria-live), Por página (10, 25, 50, 100, 200), Anterior, "Página 1 de 1", Próxima. Se a página passar do fim depois de um filtro, volta para a última (como hoje).
- **Após enviar numa etapa com `contacted=no`:** a linha não some nem pula; ela muda para o estado Contatada no lugar e o funil atualiza (Prontas −1, Contatadas +1). A lista só se recompõe ao trocar filtro, página ou recarregar. "Próxima" pula as contatadas.

### 2.7 Mapa-radar e relação com a lista

- **Dados:** camada viva = `/api/leads/points` com todos os filtros; camada de contexto = a mesma chamada só com os filtros-base, desenhada como poeira (pontos mínimos, sem interação), para a cidade continuar aparecendo quando a etapa é pequena. Enquadra os pontos vivos ao mudar filtro (margem de 32 px); após pan ou zoom manual aparece o botão "Recentrar".
- **Clicar num ponto:** seleciona a empresa, abre o painel (lateral, gaveta ou tela cheia, conforme a largura), rola a linha até ficar visível e a destaca. Ponto de empresa que não está na página atual: abre o painel (`GET /api/leads/:id`), a lista não destaca nada e a "Próxima" parte do topo da página.
- **Hover/foco em linha** faz um halo no ponto e, se ele estiver fora da vista, desloca o mapa sem mudar o zoom. **Hover em ponto** mostra "Nome · Quente 95". Com movimento reduzido: sem pulso, sem animação de deslocamento.
- **Filtros movem o mapa:** ao mudar qualquer filtro os pontos se reconstroem. O mapa não tem filtros próprios.
- **Legenda** (uma linha no pé do mapa): Quente, Morna, Fria, Contatada, "Fora do filtro". Rodapé: "{n} pontos" e, se `truncated`, "Mostrando as 3.000 de maior oportunidade de {total}".
- **Controles:** +, −, Recentrar, Recolher (todos botões). As setas movem o mapa só quando ele tem foco. O equivalente acessível do mapa é a lista; há o link "Pular o mapa" antes dele.

### 2.8 Panorama (distribuições, região inferior da lateral sem empresa aberta)

Três blocos de barras horizontais finas, linha de 28 px, cada uma um botão `aria-pressed` que alterna um filtro. Usam `stats` com todos os filtros, então descrevem a fila atual.

| Bloco | Linhas | Clique grava |
|---|---|---|
| Termômetro (`byStars`) | Quente (5), Morna (3 e 4), Fria (1 e 2) | Quente: `minStars=5`; Morna: `minStars=3` (inclui quentes; rótulo "a partir de"); Fria: remove `minStars` |
| Situação do site (`bySiteStatus`) | só as com contagem > 0, rótulos de `SITE_STATUS_LABEL` | `siteStatus` |
| Cidades e Categorias (`byCity`, `byCategory`, top 10) | uma linha por valor; **o bloco só existe com 2 ou mais valores** | `city`, `category` |

`byPlatform` não é mostrada (não há filtro de plataforma no contrato e hoje também não aparece).

## 3. Painel de detalhe

Desktop ≥ 1280: ocupa a região inferior da lateral (448 × ≈ 512, com mapa aberto), sem fundo escurecido. Tablet: gaveta modal de 440. Celular: folha em tela cheia com cabeçalho "‹ Lista". Sem empresa selecionada: Panorama. Fechar (× ou Esc) devolve o foco à linha.

```
┌──────────────────────────────────────────────┐
│ < Anterior      3 de 36     Próxima >  x     │ 40, fixo
│ Taishi                                       │ título da empresa (h2)
│ [#####] Quente 85 · Site antigo              │
├──────────────────────────────────────────────┤ o conteúdo rola
│ 1 POR QUE ABORDAR                            │ scoreReasons + siteSignals
│   Site antigo · ©2017 sem atualização        │
│   WordPress 4.4.33            [Abrir site]   │
│ 2 PARA                                       │
│   (19) 99251-1961 · WhatsApp confirmado      │ sem contato: campo aberto
│   [Trocar número]                            │
│ 3 MENSAGEM (editável, 10 a 14 linhas)        │
│   [ Olá! Tudo bem? Aqui é Adriano…      ]    │
│   Voltar à mensagem padrão                   │ só se editada
│ 4 OBSERVAÇÕES [3 linhas, salva ao sair]      │
│ 5 DADOS  v                                   │ recolhido no celular
│ 6 Excluir empresa                            │ confirmação em linha
├──────────────────────────────────────────────┤ barra fixa de 64
│  [WA Enviar proposta no WhatsApp] [Copiar]   │
└──────────────────────────────────────────────┘
Depois de enviar, a barra vira:  [ Próxima empresa > ] [Desmarcar]   Enviada às 14:32
```

**Ordem e motivo** (fluxo conferir → ajustar → enviar → anotar):
1. **Por que abordar** (era o 2º bloco): é o que se confere antes de tudo. `scoreReasons` em lista curta, mais `siteSignals` e o link "Abrir site" quando houver `website`; empresa sem site mostra "Procurar no Google" (mesma busca do campo de WhatsApp).
2. **Para:** destino do envio, colado à mensagem. Quatro casos: WhatsApp confirmado (linha + "Trocar número"); celular não confirmado ("Celular; o WhatsApp não foi confirmado."); fixo ("Telefone fixo; só funciona se a empresa usar esse número no WhatsApp."); e-mail ("Por e-mail"). **Sem contato:** o campo "WhatsApp da empresa" aparece aberto (Enter salva, erro `PHONE_FORMAT_MESSAGE`) com "Procurar no Google". Nos demais casos o campo fica atrás de "Trocar número". Links de ligar, e-mail, WhatsApp sem texto e Instagram ficam aqui como ícones.
3. **Mensagem:** textarea (cresce até 14 linhas), "Voltar à mensagem padrão" só quando editada; edição vale só para este envio e se perde ao trocar de empresa (como hoje).
4. **Barra de envio** (fixa no fundo, sempre visível): botão principal de envio (rótulos de hoje) + "Copiar mensagem" (secundário). Sem destino: só "Copiar" como principal e a frase "Informe o WhatsApp para liberar o envio."
5. **Observações** vem antes de Dados porque é parte do fluxo; salva ao sair do campo (estados Salvando, Salvo, erro, como hoje).
6. **Dados** (recolhido no celular; aberto no desktop abaixo de Observações): só linhas com valor, exceto Telefone, WhatsApp, E-mail e Site, que sempre aparecem ("Não tem", "Não confirmado"). Inclui Origem e Atualizada em. **Excluir empresa** por último, com confirmação em linha (texto atual).

### Fluxo em série

1. Padrão no desktop: sem empresa selecionada ao abrir; **J** seleciona a primeira linha (ou clique). A partir daí J/K/↑/↓ trocam a empresa e o painel acompanha.
2. **Enviar** (botão ou **E**): abre o WhatsApp em nova aba, marca como contatada (otimista; falha mostra "A conversa abriu, mas não consegui marcar como contatada." com botão "Marcar como contatada") e a barra muda para "Enviada às 14:32" com **"Próxima empresa"** como botão principal, que recebe o foco. Quem volta da aba aperta Enter e segue.
3. **Próxima empresa** vai à próxima linha não contatada da ordem atual; no fim da página carrega a seguinte; na última, mostra "Fim da fila" (seção 7). "Desmarcar" fica na barra como ação terciária.
4. **N** leva o foco às Observações; **C** copia; **Esc** fecha o painel.
5. Excluir: o foco vai para a linha seguinte; se não houver, para a barra da lista.

## 4. Pesquisas

**Foco:** iniciar uma pesquisa e ver a que está rodando. Desktop: formulário à esquerda, **360 px fixos**; histórico à direita, resto (≈ 880), rola. Celular: formulário em um bloco recolhível aberto ("Nova pesquisa"), histórico em cartões abaixo.

```
┌─ Nova pesquisa (360) ───────┐ ┌─ Histórico (cartões) ───────────────────────────────┐
│ aviso: sem chave Google     │ │ restaurante · Campinas/SP  [Em andamento] 62%       │
│ Categoria                   │ │ ########---  214 encontradas · 214 novas            │
│ Cidade        | UF          │ │ raio 10 km · Automática · até 500     [Pausar]      │
│ Raio km       | Limite      │ ├─────────────────────────────────────────────────────┤
│ Fonte                       │ │ dentista · Campinas/SP            [Concluída]       │
│ Palavras-chave (opcional)   │ │ 88 encontradas · 12 novas · 76 atualizadas          │
│ [+ Iniciar pesquisa]        │ │ 120 consultas                   Ver empresas >      │
└─────────────────────────────┘ └─────────────────────────────────────────────────────┘
```

- Campos e validações iguais aos de hoje (categoria, palavras-chave, cidade, estado, raio 1 a 100, fonte, limite 10 a 5.000) e o aviso de chave do Google no topo do formulário.
- A pesquisa em andamento ou na fila fica fixada no topo do histórico; cartão com situação, barra de progresso (%), contagens (encontradas, novas, atualizadas, consultas), Pausar/Retomar e "Ver empresas" (`/?searchId={id}&todas=1`, para não cair na etapa Prontas). Falhou: mostra o erro no cartão. Atualização a cada 2 s como hoje; o progresso não é anunciado a cada ciclo, só as mudanças de situação.
- Após iniciar: o novo cartão entra no topo e recebe o foco; anuncia "Pesquisa iniciada: {categoria} em {cidade}".

## 5. Agendamentos

**Foco:** ver o que vai rodar e quando. Desktop: lista à esquerda (resto), formulário à direita, **360 px**; ordem de leitura = lista, depois formulário (a criação é rara). O aviso "Os agendamentos só rodam enquanto o sistema estiver aberto neste computador." fica como faixa fixa de uma linha no topo da lista. Celular: lista primeiro; "+ Novo agendamento" abre o formulário em linha.

- Cartão de agendamento: título `categoria · cidade/UF`; linha grande "Próxima: {data e hora}" (só se ativo; senão "Desativado"); "Todo dia, às 03:00" e "Última: {data}" em segundo plano; chave Ativo/Desativado (`role=switch`, nome "Agendamento de {nome}"); Excluir com confirmação em linha ("Confirmar", "Cancelar").
- Formulário: os campos de pesquisa (mesmos de Pesquisas) + Frequência (Todo dia, Toda semana, Todo mês; padrão semanal) + Hora (0 a 23, padrão 3). Após criar: o cartão novo recebe o foco.

## 6. Configurações

**Foco:** a prévia da mensagem, porque toda configuração existe para produzi-la. Desktop: formulário 640 px à esquerda; **prévia fixa (sticky) de 420 px** à direita, sempre visível enquanto se edita; barra de ações fixa no rodapé (Salvar, Restaurar padrão, estado). Celular: formulário em uma coluna; barra inferior fixa com [Prévia] (folha com o mesmo conteúdo) e [Salvar].

- **Ordem dos cartões:** Você (empresa, quem envia, prazo) → Planos (1 a 5; Adicionar e Remover) → Hospedagem e domínio (caixa de incluir 1º ano, campos, link, resumo de custos e sobra por plano) → Modelo da mensagem (textarea + "Marcadores disponíveis" recolhido).
- **Prévia:** empresa de exemplo (Padaria Bom Pão, Aracaju), seletor "Situação do site da empresa de exemplo" com os seis `SITE_STATUSES`, texto atualizado ao digitar. Inválida: "Corrija os campos com problema para ver a prévia."
- Erros por campo abaixo do campo; resumo na barra: "Corrija os campos marcados antes de salvar." e o foco vai ao primeiro campo com erro. Salvo: "Configurações salvas." Restaurado: "Padrão carregado. Clique em Salvar para aplicar."

## 7. Estados e textos

| Área | Estado | Texto exato |
|---|---|---|
| Lista | Carregando | 8 linhas-esqueleto; leitor de tela: "Carregando empresas…" |
| Lista | Nenhuma empresa ainda (base vazia, sem filtro) | Título "Nenhuma empresa por aqui ainda." · corpo "Faça a primeira pesquisa e as empresas aparecem aqui, já com a nota de oportunidade." · botão "Fazer primeira pesquisa". Funil, mapa e Panorama somem |
| Lista | Filtro sem resultado | "Nenhuma empresa com esses filtros." · "Tire um filtro ou limpe todos." · botão "Limpar filtros" |
| Lista | Etapa Prontas vazia e `needsSite > reachable` | "Nenhuma empresa pronta para abordar." · "{n} empresas precisam de site, mas ainda não têm contato. Informe o WhatsApp delas para liberar o envio." · botão "Ver empresas sem contato" |
| Lista | Etapa Prontas vazia, `needsSite = reachable`, `contacted > 0` | "Nenhuma empresa pronta para abordar." · "Você já abordou todas as que têm contato. Faça uma nova pesquisa para encontrar mais." · botões "Nova pesquisa" e "Ver contatadas" |
| Lista | Etapa Prontas vazia, `needsSite = 0` | "Nenhuma empresa pronta para abordar." · "Nenhuma das {found} empresas encontradas precisa de site." · botão "Nova pesquisa" |
| Lista | Fim da fila (Próxima na última) | "Fila concluída. {n} empresas já abordadas." · botão "Voltar ao topo" |
| Lista | Erro | "Não consegui carregar as empresas." + mensagem da API em texto menor · "Tentar de novo" |
| Funil | Carregando / erro | números viram "—"; erro: "Não consegui carregar os números." · "Tentar de novo" (a lista continua usável) |
| Mapa | Carregando | "Carregando o mapa…" (área reservada de 320 px, sem salto de layout) |
| Mapa | Sem pontos, há empresas | "Nenhuma empresa deste filtro tem localização no mapa." · "A lista continua mostrando todas." |
| Mapa | Sem empresas no filtro | "Sem empresas para mostrar no mapa." |
| Mapa | Sem internet (base do mapa não carrega) | "Sem internet para carregar o mapa." · "Os pontos continuam aqui, só sem o desenho das ruas." · "Tentar de novo". Os pontos seguem desenhados sobre fundo liso |
| Mapa | Erro dos pontos | "Não consegui carregar os pontos do mapa." · "Tentar de novo" |
| Panorama | Sem dados | "Sem dados para o filtro atual." |
| Painel | Mensagem carregando / erro | "Carregando a mensagem…" / "Não consegui carregar a mensagem." · "Tentar de novo" · link "Abrir Configurações" |
| Painel | Sem contato | "Sem contato publicado. Informe o WhatsApp para liberar o envio." |
| Painel | Cópia | "Copiado" / "Não consegui copiar. Selecione o texto e copie com Ctrl+C." |
| Painel | Observação | "Salvando…" / "Salvo" / "Não consegui salvar a observação." · "Tentar de novo" |
| Painel | Excluir | "Excluir {nome}?" · "A empresa sai da lista e não volta em novas pesquisas." · "Sim, excluir" · "Cancelar" |
| Pesquisas | Vazio / carregando / erro | "Nenhuma pesquisa ainda. Preencha o formulário e clique em Iniciar pesquisa." / 3 cartões-esqueleto / "Não consegui carregar as pesquisas." · "Tentar de novo" |
| Agendamentos | Vazio / erro | "Nenhum agendamento ainda. Crie um para repetir uma pesquisa sozinho, todo dia, semana ou mês." / "Não consegui carregar os agendamentos." · "Tentar de novo" |
| Configurações | Carregando / erro | 2 blocos-esqueleto / "Não consegui carregar as configurações." · "Tentar de novo" |

## 8. Teclado e acessibilidade

**Ordem de foco (desktop):** link "Ir para o conteúdo" → trilho → topo (busca, Exportar, Nova pesquisa) → etapas do funil (5 botões) → filtros, "Mais filtros" → chips e "Limpar tudo" → barra da lista (Ordenar, direção, Atalhos) → **lista (um só ponto de Tab; ↑↓ dentro dela)** → botão de envio da linha atual → paginação → "Pular o mapa" → controles do mapa → painel (Anterior, Próxima, Fechar, blocos 1 a 6, barra de envio). No celular a ordem é a da tela de cima para baixo e a folha do painel prende o foco.

| Tecla | Efeito (desliga dentro de campo de texto, select e textarea) |
|---|---|
| J / K (↓ e ↑ só com o foco na lista) | Seleciona a próxima / anterior linha; o painel acompanha; rola a linha para a vista |
| Enter | Na linha: abre o painel e leva o foco à mensagem |
| E | Envia a proposta da empresa selecionada (mesmo efeito do botão) |
| N / C | Foco em Observações / copia a mensagem |
| M | Recolhe ou abre o mapa |
| / | Foco na busca |
| ? | Abre a lista de atalhos (popover) |
| Esc | Fecha o que estiver aberto, nesta ordem: popover ou menu, painel, seleção |

Sem atalhos com Ctrl/Alt (não colidem com o navegador). Toda ação por tecla existe também como botão.

**Gestão de foco:** fechar o painel devolve o foco à linha; clicar numa etapa do funil mantém o foco nela; enviar leva o foco a "Próxima empresa"; excluir leva à linha seguinte; abrir "Mais filtros" foca o 1º campo e Esc volta ao botão; folha do celular é `dialog` (foco preso).

**aria-live (`polite`, uma só região visualmente oculta no espaço de trabalho, com 400 ms de espera para não repetir):**
- Mudou filtro, etapa, ordem ou página: "36 empresas. Etapa: Prontas para abordar." e "Página 2 de 5, 50 empresas."
- Selecionou empresa: "{Nome}, {Quente|Morna|Fria} {score} de 100, {situação do site}. {n} de {total}."
- Enviou: "Proposta aberta no WhatsApp para {Nome}. Marcada como contatada." Falha: `role="alert"` com o texto de erro.
- Mapa atualizou: "Mapa: {n} empresas." (mesma região). Pesquisa mudou de situação: "Pesquisa concluída: 214 empresas encontradas."

**Outros:** termômetro é `role="img"` ("Quente, 85 de 100"); contatada tem texto ("Contatada"), não só o anel; alvos de 44 px no celular e 40 px no desktop; o mapa é `region` com nome "Mapa das empresas, {n} pontos"; `prefers-reduced-motion` desliga brilho pulsante, deslocamento do mapa e transições de linha.

## 9. O que sai

| Sai | Por quê | O que fica da função |
|---|---|---|
| Seis cartões (Total, Sem site, Com site, Com WhatsApp, Sem WhatsApp, 5★) | Números iguais sem ação clara | Funil + Panorama; `hasSite` em "Mais filtros", `hasWhatsapp` e `minStars` já existem |
| Seção "Gráficos" com Recolher, rosca e barras grandes | Ocupam a primeira dobra sem ajudar a escolher | Panorama com barras finas clicáveis |
| Barras de cidade e categoria com um valor só (214 de 214) | Não informam | Texto no subtítulo do topo |
| Colunas Local, Site, Nota e Contato separadas; cabeçalho fixo; rolagem horizontal | Largura sem ganho | Fundidas na linha; contatos no painel |
| Motivo em 2 linhas na coluna Oportunidade | Quebra a altura da linha | Uma linha na linha 2; completo no painel |
| Gaveta modal com fundo escurecido no desktop | Cobre a fila e impede o trabalho em série | Painel fixo ao lado |
| "Mais filtros" que empurra a página e trava desabilitado | Desloca a tabela | Popover + chips |
| Linhas "—" no bloco Dados | Ruído | Só o que tem valor |
| Subtítulo "Empresas encontradas e quais delas precisam de um site." e nome longo no trilho | Texto decorativo | Recorte no topo e monograma |
| Tabelas de Pesquisas e Agendamentos (largura mínima 56 rem) | Rolagem horizontal | Cartões |
| Estrelas | Substituídas | Termômetro |

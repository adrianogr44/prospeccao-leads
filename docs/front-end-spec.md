# Front-end Spec — Prospecção de Leads

Status: Validado em 30/09/2026

## Direção visual

Ferramenta de trabalho no espírito Notion/HubSpot: densa, calma, sem enfeite. Superfícies neutras, uma cor de destaque (verde) reservada para ação principal e oportunidade. Sem gradientes, sem sombras pesadas, sem emojis. Tipografia de sistema via `next/font` (Inter). Números tabulares nas colunas numéricas.

Tokens como variáveis CSS em `globals.css`, com tema claro e escuro (classe `dark` no `<html>`, preferência salva em `localStorage`, padrão do sistema, sem piscar ao carregar).

| Token | Claro | Escuro |
|---|---|---|
| fundo | `#ffffff` | `#0f1011` |
| superfície | `#f7f7f5` | `#17181a` |
| borda | `#e6e6e3` | `#2a2c2f` |
| texto | `#1f1f1e` | `#ececea` |
| texto secundário | `#6b6b68` | `#9a9a96` |
| destaque | `#0f7b4f` | `#3ecf8e` |
| alerta | `#b45309` | `#f0a44b` |
| perigo | `#b42318` | `#f97066` |

## Estrutura

Barra lateral fixa (vira barra superior no celular) com: Dashboard, Pesquisas, Agendamentos, e o alternador de tema no rodapé.

### `/` Dashboard

1. **Cabeçalho**: título, botão "Nova pesquisa" (leva a `/pesquisas`), menu "Exportar" (Excel, CSV, JSON, Google Sheets).
2. **Indicadores** (cards): Total, Sem site, Com site, Com WhatsApp, Sem WhatsApp, Oportunidades 5★. Clicar em um card aplica o filtro correspondente.
3. **Gráficos** (Chart.js, carregados sob demanda): rosca de situação do site, barras de estrelas, barras horizontais de top cidades e top categorias. Recolhível.
4. **Filtros**: busca instantânea (debounce 250 ms), cidade, estado, categoria, situação do site, tem WhatsApp, tem Instagram, nota mínima, avaliações (mín./máx.), estrelas mínimas, pesquisa de origem. Botão "Limpar". Filtros ficam na URL (compartilhável, sobrevive a F5).
5. **Tabela**: colunas Oportunidade (estrelas + motivo principal), Empresa (nome + categoria), Local (bairro, cidade/UF), Site (situação em etiqueta + plataforma), Nota (nota e nº de avaliações), Contato (ícones de WhatsApp, telefone, e-mail, Instagram, clicáveis). Cabeçalho fixo, ordenação por clique, paginação com total e tamanho de página. Rolagem horizontal no celular.
6. **Painel de detalhe** (abre à direita ao clicar na linha, fecha com Esc): todos os campos, motivos do score, sinais do site, links (Maps, site, redes), botão "Abrir WhatsApp" quando houver, observações editáveis (salva ao sair do campo), excluir lead com confirmação.

Os indicadores e gráficos obedecem aos mesmos filtros da tabela.

### `/pesquisas`

Formulário: categoria, palavras-chave, cidade, estado (UF), raio em km, fonte (automática, Google, OpenStreetMap), limite de leads. Aviso quando a chave do Google não está configurada. Abaixo, histórico: parâmetros, situação, barra de progresso, encontrados/novos/atualizados/consultas, ações pausar/retomar e "Ver leads" (dashboard filtrado por essa pesquisa). Atualiza a cada 2 s enquanto houver pesquisa em andamento.

### `/agendamentos`

Formulário igual ao de pesquisa + frequência e hora. Lista com próxima execução, última execução, ativar/desativar e excluir. Aviso de que só roda com o sistema aberto.

## Estados

Toda área de dados tem: carregando (esqueleto), vazio (mensagem + ação, por exemplo "Nenhuma empresa ainda. Faça sua primeira pesquisa."), erro (mensagem + tentar de novo).

## Acessibilidade

HTML semântico (`table`, `th scope`, `button`, `label`), foco visível, tudo operável por teclado, `aria-sort` nos cabeçalhos, `aria-live` no progresso, contraste AA nos dois temas, estrelas com texto alternativo ("5 de 5").

## Texto

Português do Brasil, direto, sem jargão. Exemplos: "Sem site", "Site antigo", "Só rede social", "Celular" (nunca "WhatsApp" quando não confirmado).

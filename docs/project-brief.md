# Project Brief — Prospecção de Leads

Status: Validado em 30/09/2026

## Problema

Achar empresas que precisam de um site novo é manual: pesquisar no Maps, abrir perfil por perfil, conferir se tem site, anotar telefone. Rende poucas dezenas por dia e sem critério de prioridade.

## Solução

Ferramenta local que pesquisa empresas por segmento e cidade em fontes permitidas (Google Places API oficial e OpenStreetMap), analisa o site de cada uma, dá nota de oportunidade de 1 a 5 estrelas e entrega tudo em um dashboard filtrável com exportação para planilha.

## Usuário

Equipe comercial e de desenvolvimento da agência. Um usuário por vez, no próprio computador.

## Objetivos

1. Levantar centenas a milhares de empresas por pesquisa, sem intervenção.
2. Mostrar primeiro quem claramente precisa de site: sem site, site antigo, só Instagram.
3. Entregar contato pronto para abordagem (WhatsApp quando publicado, telefone, e-mail, redes).
4. Exportar para Excel, CSV, Google Sheets e JSON.

## Restrições

- Respeitar os Termos de Serviço das fontes: sem raspagem do Google Maps.
- LGPD: só dados publicados pela própria empresa; nunca inferir dado ausente; permitir exclusão.
- Rodar em Windows só com Node.js (Python bloqueado neste PC).
- Google Places API tem custo por consulta acima da cota gratuita.

## Fora do escopo

Disparo de mensagens, CRM/funil de vendas, login multiusuário, hospedagem pública.

## Decisões tomadas com o usuário (30/09/2026)

| Tema | Decisão |
|---|---|
| Fonte de dados | Places API + OpenStreetMap |
| Stack | Next.js único + Prisma + SQLite |
| Local | `Documents/prospeccao-leads`, repositório próprio |

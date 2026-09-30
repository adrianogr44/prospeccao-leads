# Epic 1 — MVP de prospecção de leads

Status: Implementado, aguardando validação com chave do Google · Criado em 30/09/2026

## Objetivo

Entregar a ferramenta local completa descrita no PRD: coleta em volume por fontes permitidas, análise de site, score, dashboard, exportação e agendamento.

## Stories

| Story | Título | Status |
|---|---|---|
| 1.1 | Coleta, dedupe e fila de pesquisas | Implementada |
| 1.2 | Enriquecimento, score, exportação e agendamento | Implementada |
| 1.3 | Dashboard, pesquisas e agendamentos (interface) | Implementada |

## Dependências

1.2 depende dos modelos e do upsert de 1.1. 1.3 depende só do contrato `src/lib/contract.ts`, então corre em paralelo.

## Pronto quando

Os critérios de sucesso do PRD passam em teste real com OpenStreetMap, e `lint`, `typecheck`, `test` e `build` passam.

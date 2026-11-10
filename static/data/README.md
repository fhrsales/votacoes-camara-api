Dados gerados automaticamente pela rotina `scripts/fetch-votacoes.mjs`.

- `votacoes/`: índices mensais e `index.json` com meses disponíveis.
- `votos/`: votos por ID de votação.
- `orientacoes/`: orientação de cada partido, federação, bloco e do governo por votação (`scripts/fetch-orientacoes.mjs`).
- `perfis/`: perfil de cada deputado da legislatura atual e `index.json` com o resumo de todos (`scripts/build-perfis.mjs`).
- `deputados/bio/`: ficha de cada deputado (nome civil, nascimento, escolaridade, profissões, ocupações e mandatos fora da Câmara), sem CPF (`scripts/fetch-biografias.mjs`).
- `custos/`: gastos de cada deputado com a cota parlamentar (CEAP) desde fev/2023, somados a partir dos arquivos anuais da Câmara; CPFs descartados e fornecedores pessoa física anonimizados (`scripts/build-custos.mjs`).
- `senado/`: as mesmas pastas para o Senado Federal (`votacoes/`, `votos/`, `orientacoes/`, `bio/`, `custos/`, `perfis/`), geradas por `fetch-senado.mjs`, `fetch-senado-orientacoes.mjs`, `fetch-senado-bio.mjs`, `build-custos-senado.mjs` e `CASA=senado build-perfis.mjs`. Os custos vêm da CEAPS; fornecedores pessoa física aparecem só como "Pessoa física".

## governabilidade/

Quanto o plenário da Câmara seguiu a orientação do líder do governo, de Lula 1 (2003) até hoje,
a partir dos arquivos anuais de dados abertos da Câmara (votações, orientações e votos).
`anos/{ano}.json` resume cada ano (por governo: votações, vitórias, votos que seguiram, partidos e
deputados); `index.json` junta tudo por governo e mês a mês. Gerado por
`scripts/build-governabilidade.mjs`; a rotina diária refaz o ano atual e o anterior
(`GOV_ANOS=2003-2026` refaz todos).

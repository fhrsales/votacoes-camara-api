Dados gerados automaticamente pela rotina `scripts/fetch-votacoes.mjs`.

- `votacoes/`: índices mensais e `index.json` com meses disponíveis.
- `votos/`: votos por ID de votação.
- `orientacoes/`: orientação de cada partido, federação, bloco e do governo por votação (`scripts/fetch-orientacoes.mjs`).
- `perfis/`: perfil de cada deputado da legislatura atual e `index.json` com o resumo de todos (`scripts/build-perfis.mjs`).
- `deputados/bio/`: ficha de cada deputado (nome civil, nascimento, escolaridade, profissões, ocupações e mandatos fora da Câmara), sem CPF (`scripts/fetch-biografias.mjs`).
- `custos/`: gastos de cada deputado com a cota parlamentar (CEAP) desde fev/2023, somados a partir dos arquivos anuais da Câmara; CPFs descartados e fornecedores pessoa física anonimizados (`scripts/build-custos.mjs`).

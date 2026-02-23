# Votações da Câmara — SvelteKit

Demo que lista votações e votos da Câmara dos Deputados.

## Deploy no GitHub Pages (automático)

Este projeto está configurado para publicar no **GitHub Pages** via **GitHub Actions**.

### 1) Configure o Pages

No GitHub:

- **Settings → Pages**
- **Source:** GitHub Actions

### 2) Branch de deploy

O workflow publica quando há push no branch `main`.

Se o seu branch principal for `master`, altere em:

- `.github/workflows/pages.yml`

### 3) URL do site

Após o deploy, a URL será:

- `https://SEU_USUARIO.github.io/NOME_DO_REPO/`

## Scripts úteis

```bash
npm run dev
npm run build
```

## Observações

- O app é **estático** no Pages.  
- Os dados são gerados diariamente e salvos em JSON em `static/data`.

## Troubleshooting

### 404 ao abrir links internos

Confirme que o `fallback: 'index.html'` está ativo em `svelte.config.js`.

### Dados desatualizados

Execute `npm run fetch:data` localmente ou aguarde a rotina diária do GitHub Actions
(`.github/workflows/scrape.yml`). Para rodar manualmente, abra **Actions → Atualizar dados de votações**
e clique em **Run workflow**. Ao finalizar com sucesso, o deploy do Pages é disparado automaticamente
via `workflow_run` do `.github/workflows/pages.yml`. Você também pode disparar o deploy manualmente em
**Actions → Deploy to GitHub Pages**.

Para verificar o status, acompanhe o card do workflow em **Actions** e abra o job mais recente para ver
logs e o resultado (success/failed).

Links diretos:
- `https://github.com/fhrsales/votacoes-camara-api/actions/workflows/scrape.yml`
- `https://github.com/fhrsales/votacoes-camara-api/actions/workflows/pages.yml`

### Build não publica

Verifique:

- **Settings → Pages**: Source = GitHub Actions
- O push foi feito no branch configurado no workflow (`main`)

## Badges

Badge do deploy:

```md
[![Deploy to GitHub Pages](https://github.com/fhrsales/votacoes-camara-api/actions/workflows/pages.yml/badge.svg)](https://github.com/fhrsales/votacoes-camara-api/actions/workflows/pages.yml)
```

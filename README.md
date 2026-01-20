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
- As chamadas de API usam um **proxy CORS público** para funcionar no navegador.

## Troubleshooting

### 404 ao abrir links internos

Confirme que o `fallback: 'index.html'` está ativo em `svelte.config.js`.

### Erro de CORS ao buscar votações

O Pages é estático. Se o proxy CORS estiver instável, troque o endpoint usado em
`src/routes/Votacoes.svelte` (`CORS_PROXY`).

### Build não publica

Verifique:

- **Settings → Pages**: Source = GitHub Actions
- O push foi feito no branch configurado no workflow (`main`)

## Badges

Badge do deploy:

```md
[![Deploy to GitHub Pages](https://github.com/fhrsales/votacoes-camara-api/actions/workflows/pages.yml/badge.svg)](https://github.com/fhrsales/votacoes-camara-api/actions/workflows/pages.yml)
```

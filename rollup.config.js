import svelte from 'rollup-plugin-svelte';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.js',
  output: {
    file: 'public/uva-render-placar-votacao.js',
    format: 'iife',
    name: 'UvaRender'
  },
  plugins: [
    svelte({
      extensions: ['.svelte', '.css'],
      include: ['src/**/*.svelte', 'node_modules/svelte-intersection-observer/src/*.svelte', 'src/styles/*.css'],
      emitCss: false,
    }),
    resolve({
        browser: true,
        preferBuiltins: true
      }),
      commonjs({
        namedExports: false
      }),
      terser()
  ]
};
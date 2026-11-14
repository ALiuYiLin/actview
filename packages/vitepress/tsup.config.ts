import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/client/index.ts',
    'src/client/entry.ts',
    'src/node/actviewPlugin.ts',
    'src/node/cli.ts',
  ],
  format: ['esm'],
  dts: {
    compilerOptions: {
      ignoreDeprecations: '6.0',
      composite: false,
      rootDir: '..',
    },
  },
  clean: true,
  outDir: 'dist',
  external: [
    'actview',
    '@actview/core',
    'vite',
    'virtual:actview-site',
    /\.css(\?.*)?$/,
  ],
})

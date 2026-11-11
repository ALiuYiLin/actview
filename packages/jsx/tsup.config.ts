import path from 'node:path'
import { defineConfig } from 'tsup'

// runtime-core 源码路径：构建命令在包目录下执行
const runtimeCoreSrc = path.resolve(
  process.cwd(),
  '../runtime-core/src/index.ts',
)

export default defineConfig({
  entry: ['src/index.ts', 'src/jsx-runtime.ts', 'src/jsx-dev-runtime.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: { ignoreDeprecations: '6.0' },
  },
  clean: true,
  outDir: 'dist',
  esbuildOptions(options) {
    // workspace 内免 install 解析 @actview/runtime-core（等价 workspace link）
    options.alias = {
      ...(options.alias ?? {}),
      '@actview/runtime-core': runtimeCoreSrc,
    }
  },
})

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/transport'],
  dts: true,
  format: ['cjs', 'esm', 'iife'],
  shims: true,
  clean: true,
})

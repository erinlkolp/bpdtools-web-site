import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bpdtools.cloud',
  output: 'static',
  build: { format: 'file' },
});

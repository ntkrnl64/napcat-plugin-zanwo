import { resolve, dirname } from 'path';
import { defineConfig } from 'vite';
import nodeResolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { napcatHmrPlugin } from 'napcat-plugin-debug-cli/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeModules = [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
].flat();

function copyPackageJsonPlugin() {
    return {
        name: 'copy-package-json',
        writeBundle() {
            const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
            const distPkg: Record<string, unknown> = {
                name: pkg.name,
                plugin: pkg.plugin,
                version: pkg.version,
                type: pkg.type,
                main: pkg.main,
                description: pkg.description,
                author: pkg.author,
            };
            if (pkg.napcat) distPkg.napcat = pkg.napcat;
            fs.writeFileSync(
                resolve(__dirname, 'dist/package.json'),
                JSON.stringify(distPkg, null, 2)
            );
        },
    };
}

export default defineConfig({
    resolve: {
        conditions: ['node', 'default'],
    },
    build: {
        sourcemap: false,
        target: 'esnext',
        minify: false,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: () => 'index.mjs',
        },
        rollupOptions: {
            external: [...nodeModules],
            output: {
                inlineDynamicImports: true,
            },
        },
        outDir: 'dist',
    },
    plugins: [nodeResolve(), copyPackageJsonPlugin(), napcatHmrPlugin()],
});

import { resolve, dirname } from 'path';
import { defineConfig } from 'vite';
import nodeResolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { napcatHmrPlugin } from 'napcat-plugin-debug-cli/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nodeModules = [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
].flat();

function copyDirRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = resolve(src, entry.name);
        const d = resolve(dest, entry.name);
        entry.isDirectory() ? copyDirRecursive(s, d) : fs.copyFileSync(s, d);
    }
}

function copyAssetsPlugin() {
    return {
        name: 'copy-assets',
        writeBundle() {
            const distDir = resolve(__dirname, 'dist');
            const webuiRoot = resolve(__dirname, 'src/webui');

            // Build WebUI
            try {
                if (!fs.existsSync(resolve(webuiRoot, 'node_modules'))) {
                    console.log('[copy-assets] Installing WebUI deps...');
                    execSync('pnpm install', { cwd: webuiRoot, stdio: 'pipe' });
                }
                console.log('[copy-assets] Building WebUI...');
                execSync('pnpm run build', { cwd: webuiRoot, stdio: 'pipe' });
                console.log('[copy-assets] WebUI built.');
            } catch (e: any) {
                console.error('[copy-assets] WebUI build failed:', e.stdout?.toString().slice(-500) || e.message);
            }

            // Copy WebUI dist → dist/webui
            const webuiDist = resolve(webuiRoot, 'dist');
            if (fs.existsSync(webuiDist)) {
                copyDirRecursive(webuiDist, resolve(distDir, 'webui'));
                console.log('[copy-assets] Copied webui/');
            }

            // Write slim package.json
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
            fs.writeFileSync(resolve(distDir, 'package.json'), JSON.stringify(distPkg, null, 2));
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
    plugins: [nodeResolve(), copyAssetsPlugin(), napcatHmrPlugin()],
});

import fs from 'fs';
import path from 'path';
import type { PluginModule, NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { EventType } from 'napcat-types/napcat-onebot/event/index';

interface Config {
    blockedGroups: string[];
    blockedUsers: string[];
}

let selfId = '';
let config: Config = { blockedGroups: [], blockedUsers: [] };
let configPath = '';

function loadConfig(): void {
    try {
        if (configPath && fs.existsSync(configPath)) {
            const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config = {
                blockedGroups: Array.isArray(raw.blockedGroups) ? raw.blockedGroups.map(String) : [],
                blockedUsers: Array.isArray(raw.blockedUsers) ? raw.blockedUsers.map(String) : [],
            };
        }
    } catch { /* use defaults */ }
}

function saveConfig(ctx: NapCatPluginContext): void {
    try {
        const dir = path.dirname(configPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
        ctx.logger.warn('保存配置失败:', e);
    }
}

export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
    configPath = ctx.configPath;
    loadConfig();

    try {
        const res = await ctx.actions.call(
            'get_login_info', {}, ctx.adapterName, ctx.pluginManager.config
        ) as { user_id?: number | string };
        if (res?.user_id) selfId = String(res.user_id);
    } catch { /* ignore */ }

    ctx.logger.info(`zanwo 已加载${selfId ? `，QQ: ${selfId}` : ''}`);

    // WebUI page
    ctx.router.page({
        path: 'config',
        title: '赞我配置',
        htmlFile: 'webui/index.html',
        description: '黑名单配置',
    });

    // NoAuth API routes
    ctx.router.getNoAuth('/config', (_req: unknown, res: any) => {
        res.json({ code: 0, data: config });
    });

    ctx.router.postNoAuth('/config', (req: any, res: any) => {
        try {
            const body: Record<string, unknown> = req.body ?? {};
            if (Array.isArray(body.blockedGroups))
                config.blockedGroups = (body.blockedGroups as unknown[]).map(String);
            if (Array.isArray(body.blockedUsers))
                config.blockedUsers = (body.blockedUsers as unknown[]).map(String);
            saveConfig(ctx);
            res.json({ code: 0 });
        } catch (e) {
            res.status(500).json({ code: -1, message: String(e) });
        }
    });
};

export const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx, event) => {
    if (event.post_type !== EventType.MESSAGE) return;

    // Blacklist check
    if (event.group_id && config.blockedGroups.includes(String(event.group_id))) return;
    if (event.user_id && config.blockedUsers.includes(String(event.user_id))) return;

    // Parse message segments: collect text and non-bot at targets
    const atTargets: string[] = [];
    let textContent = '';

    for (const seg of (event.message as Array<{ type: string; data: Record<string, string> }>)) {
        if (seg.type === 'at') {
            const qq = String(seg.data.qq ?? '');
            if (qq && qq !== selfId) atTargets.push(qq);
        } else if (seg.type === 'text') {
            textContent += seg.data.text ?? '';
        }
    }

    textContent = textContent.trim();

    if (!textContent.startsWith('.zanwo') && !textContent.startsWith('.zan')) return;

    const parts = textContent.split(/\s+/).filter(Boolean);
    const cmd = parts[0].toLowerCase();

    if (cmd === '.zanwo') {
        const n = clamp(parseInt(parts[1] ?? '') || 10, 1, 20);
        const ok = await sendLike(ctx, String(event.user_id), n);

    } else if (cmd === '.zan') {
        let target: string;
        let n: number;

        if (atTargets.length > 0) {
            target = atTargets[0];
            n = clamp(parseInt(parts[1] ?? '') || 1, 1, 20);
        } else if (parts[1] && /^\d+$/.test(parts[1])) {
            target = parts[1];
            n = clamp(parseInt(parts[2] ?? '') || 1, 1, 20);
        } else {
            return;
        }
        const ok = await sendLike(ctx, target, n);
    }
};

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

async function sendLike(ctx: NapCatPluginContext, userId: string, times: number): Promise<boolean> {
    try {
        await ctx.actions.call(
            'send_like', { user_id: userId, times },
            ctx.adapterName, ctx.pluginManager.config
        );
        return true;
    } catch (e) {
        return false;
    }
}

import type { PluginModule, NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { OB11Message, OB11PostSendMsg } from 'napcat-types/napcat-onebot';
import { EventType } from 'napcat-types/napcat-onebot/event/index';

let selfId = '';

export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
    try {
        const res = await ctx.actions.call(
            'get_login_info', {}, ctx.adapterName, ctx.pluginManager.config
        ) as { user_id?: number | string };
        if (res?.user_id) selfId = String(res.user_id);
    } catch { /* ignore */ }
    ctx.logger.info(`zanwo 已加载${selfId ? `，QQ: ${selfId}` : ''}`);
};

export const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx, event) => {
    if (event.post_type !== EventType.MESSAGE) return;

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

    // Must start with a recognized command
    if (!textContent.startsWith('.zanwo') && !textContent.startsWith('.zan')) return;

    const parts = textContent.split(/\s+/).filter(Boolean);
    const cmd = parts[0].toLowerCase();

    if (cmd === '.zanwo') {
        // .zanwo [n]  — like the sender
        const n = clamp(parseInt(parts[1] ?? '') || 10, 1, 20);
        const ok = await sendLike(ctx, String(event.user_id), n);
        await reply(ctx, event, ok ? `已为你点赞 ${n} 次！` : '点赞失败（频率过快或用户不存在）');

    } else if (cmd === '.zan') {
        // .zan @user [n]  or  .zan <user_id> [n]
        let target: string;
        let n: number;

        if (atTargets.length > 0) {
            // mention: at segments carry the target, remaining text args carry n
            target = atTargets[0];
            n = clamp(parseInt(parts[1] ?? '') || 1, 1, 20);
        } else if (parts[1] && /^\d+$/.test(parts[1])) {
            // plain QQ number
            target = parts[1];
            n = clamp(parseInt(parts[2] ?? '') || 1, 1, 20);
        } else {
            await reply(ctx, event, '用法：.zan @用户 [次数] 或 .zan QQ号 [次数]');
            return;
        }

        const ok = await sendLike(ctx, target, n);
        await reply(ctx, event, ok ? `已为 ${target} 点赞 ${n} 次！` : '点赞失败');
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
        ctx.logger.warn(`send_like 失败: userId=${userId}, times=${times}`, e);
        return false;
    }
}

async function reply(ctx: NapCatPluginContext, event: OB11Message, text: string): Promise<void> {
    try {
        const params: OB11PostSendMsg = {
            message: text,
            message_type: event.message_type,
            ...(event.message_type === 'group' && event.group_id
                ? { group_id: String(event.group_id) }
                : { user_id: String(event.user_id) }),
        };
        await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
    } catch (e) {
        ctx.logger.warn('回复消息失败:', e);
    }
}

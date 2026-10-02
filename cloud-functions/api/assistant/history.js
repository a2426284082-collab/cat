import { json, requireAssistant } from '../../_lib/assistant-auth.js';
import { logs, deleteConversation } from '../../_lib/assistant-store.js';
export async function onRequestGet({ env, request }) {
  const session = requireAssistant(request, env);
  if (!session) return json({ success: false, message: '请先登录' }, 401);
  try {
    const data = (await logs(env)).filter(v => v.salesId === session.salesId && !v.conversationId.startsWith('deleted_')).sort((a, b) => b.time.localeCompare(a.time));
    return json({ success: true, data });
  } catch { return json({ success: false, message: '读取历史失败，请重试' }, 502); }
}
export async function onRequestDelete({ env, request }) {
  const session = requireAssistant(request, env);
  if (!session) return json({ success: false, message: '请先登录' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(body?.conversationId || '') || body.conversationId.startsWith('deleted_')) return json({ success: false, message: '无效的对话' }, 400);
  try {
    await deleteConversation(env, session.salesId, body.conversationId);
    return json({ success: true });
  } catch { return json({ success: false, message: '删除未完成，请重试' }, 502); }
}

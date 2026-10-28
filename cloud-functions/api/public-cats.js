// ADMIN_CONTROL_PATCH_V1
import {readWorkbench} from '../_lib/workbench-control.js';
import { getCatalog } from '../_lib/feishu.js';

const CODES = new Set(['CONFIG_MISSING', 'FEISHU_TIMEOUT', 'FEISHU_NETWORK_ERROR', 'FEISHU_HTTP_ERROR', 'FEISHU_API_ERROR', 'FEISHU_INVALID_RESPONSE', 'FEISHU_TOKEN_MISSING']);
const VARIABLES = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'];

export async function onRequestGet({ env }) {
  try {
    const { cats, updatedAt } = await getCatalog(env);
    return new Response(JSON.stringify({ success: true, data: cats, updatedAt, settings:await readWorkbench(env.SALES_DB) }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=60, must-revalidate', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (error) {
    const details = { code: CODES.has(error?.code) ? error.code : 'CATALOG_READ_FAILED' };
    if (details.code === 'CONFIG_MISSING') details.missing = VARIABLES.filter(key => !env?.[key]);
    if (['auth', 'records', 'media'].includes(error?.stage)) details.stage = error.stage;
    if (Number.isInteger(error?.upstreamStatus) && error.upstreamStatus >= 100 && error.upstreamStatus <= 599) details.upstreamStatus = error.upstreamStatus;
    if (Number.isInteger(error?.feishuCode)) details.feishuCode = error.feishuCode;
    console.warn('catalogue_load_failed', JSON.stringify(details));
    return new Response(JSON.stringify({ success: false, message: '暂时无法读取猫咪资料，请稍后重试', ...details }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
}

// ADMIN_CONTROL_PATCH_V1
import {readWorkbench} from '../_lib/workbench-control.js';
import { getCatalog } from '../_lib/feishu.js';
import { readPublicCatalog, savePublicCatalog, saveImagePermissions } from '../_lib/catalog-edge-cache.js';

const CODES = new Set(['CONFIG_MISSING', 'FEISHU_TIMEOUT', 'FEISHU_NETWORK_ERROR', 'FEISHU_HTTP_ERROR', 'FEISHU_API_ERROR', 'FEISHU_INVALID_RESPONSE', 'FEISHU_TOKEN_MISSING']);
const VARIABLES = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'];

function jsonResponse(payload){return new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});}

export async function onRequestGet({ env, request, waitUntil }) {
  try {
    // Only the already-sanitized PUBLIC response is stored on the edge.
    // This avoids a new Feishu table scan for each fresh Worker isolate.
    const fresh = request && new URL(request.url).searchParams.get('fresh') === '1';
    const cached = fresh ? null : await readPublicCatalog(env, request);
    if (cached && Array.isArray(cached.data)) return jsonResponse({success:true,data:cached.data,updatedAt:cached.updatedAt,settings:await readWorkbench(env.SALES_DB)});
    const { cats, updatedAt, imageTokens } = await getCatalog(env,{fresh:!!fresh});
    // This endpoint is anonymous. Partner prices and unrestricted notes belong
    // exclusively to /api/agent/catalog, which validates an activated session.
    const data=cats.map(cat=>({id:cat.id,breed:cat.breed,color:cat.color,gender:cat.gender,age:cat.age,vaccine:cat.vaccine,image:cat.image,images:cat.images,videos:(cat.videos||[]).map(v=>({url:v.url}))}));
    const payload = { success: true, data, updatedAt, settings:await readWorkbench(env.SALES_DB) };
    await Promise.all([savePublicCatalog(env, request, {data,updatedAt}, waitUntil),saveImagePermissions(env,request,imageTokens,waitUntil)]);
    return jsonResponse(payload);
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

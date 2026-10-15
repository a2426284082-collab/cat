const SAFE_CODES = new Set(['CONFIG_MISSING', 'AUTH_HASH_INVALID', 'AUTH_REFRESH_REQUIRED', 'FEISHU_TIMEOUT', 'FEISHU_NETWORK_ERROR', 'FEISHU_HTTP_ERROR', 'FEISHU_API_ERROR', 'FEISHU_INVALID_RESPONSE', 'FEISHU_TOKEN_MISSING']);
const VARIABLES = new Set(['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID', 'FEISHU_SALES_TABLE_ID', 'FEISHU_AI_LOG_TABLE_ID', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'ASSISTANT_SESSION_SECRET']);

export function serviceFailure(error, message = '服务暂时不可用，请稍后重试', status = 503) {
  const details = { code: SAFE_CODES.has(error?.code) ? error.code : 'SERVICE_UNAVAILABLE' };
  if (Array.isArray(error?.missing)) details.missing = error.missing.filter(key => VARIABLES.has(key));
  if (['auth', 'records', 'media'].includes(error?.stage)) details.stage = error.stage;
  if (Number.isInteger(error?.upstreamStatus) && error.upstreamStatus >= 100 && error.upstreamStatus <= 599) details.upstreamStatus = error.upstreamStatus;
  if (Number.isInteger(error?.feishuCode)) details.feishuCode = error.feishuCode;
  console.warn('service_request_failed', JSON.stringify(details));
  return new Response(JSON.stringify({ success: false, message, ...details }), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export function requiredConfiguration(env, names) {
  const missing = names.filter(name => !String(env?.[name] || '').trim());
  if (missing.length) throw Object.assign(new Error('configuration missing'), { code: 'CONFIG_MISSING', missing });
}

const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Perform the existing expensive password derivation in the browser. Only a
// short-lived, origin-bound proof is sent; never send the stored verifier.
export async function loginProof(parameters, password) {
  if (!globalThis.crypto?.subtle) throw new Error('请使用 HTTPS 地址和新版浏览器登录');
  const { algorithm, salt, iterations, challenge } = parameters || {};
  if (typeof challenge !== 'string' || challenge.length > 2048 || !/^[A-Za-z0-9_-]{1,128}$/.test(salt || '')) throw new Error('登录验证信息无效，请刷新页面');
  const input = new TextEncoder().encode(String(password));
  let key;
  if (algorithm === 'pbkdf2-sha256' && Number.isInteger(iterations) && iterations >= 100000 && iterations <= 2000000) {
    const material = await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveBits']);
    key = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(salt), iterations }, material, 256);
  } else if (algorithm === 'sha256-token') {
    const saltBytes = decode(salt), value = new Uint8Array(saltBytes.length + input.length);
    value.set(saltBytes); value.set(input, saltBytes.length);
    key = await crypto.subtle.digest('SHA-256', value);
  } else throw new Error('登录验证方式无效，请刷新页面');
  const signingKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return encode(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(`cat-login-v1:${challenge}`)));
}

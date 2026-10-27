import { json } from '../../_lib/admin-auth.js';
export async function onRequestPost() {
  return json({success:false,message:'销售助手已升级，请前往首页使用销售激活码',code:'SALES_ASSISTANT_MOVED'},410);
}

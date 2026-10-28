import React,{useState} from 'react';
import {commentTips} from './sales-tools.js';
export default function CommentTips(){const [copied,setCopied]=useState(-1),[error,setError]=useState('');return <details className="comment-tips"><summary>💬 小红书 / 抖音评论区回复锦囊</summary><p>按平台当前规则正常交流，以下话术不保证账号不会受限。</p>{commentTips.map((tip,i)=><div key={tip}><p>{tip}</p><button onClick={async()=>{try{await navigator.clipboard.writeText(tip);setCopied(i);}catch{setError('请手动选择话术复制');}}}>{copied===i?'已复制':'复制这句'}</button></div>)}{error&&<small role="alert">{error}</small>}</details>;}

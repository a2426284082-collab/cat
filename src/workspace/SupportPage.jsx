import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Compass, GraduationCap, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
const tools=[
  {to:'/guide/',icon:BookOpen,name:'基础与成交手册',tag:'先了解规则',copy:'合作规则、报价与客户沟通，按当前问题快速查阅。',items:'合作方式 / 成交确认 / 常用回复',tone:'peach'},
  {to:'/guide-sales/',icon:Compass,name:'销路实操手册',tag:'找到第一位客户',copy:'从内容发布、需求搜索到合作转介绍，把动作做具体。',items:'内容发布 / 寻找需求 / 合作渠道',tone:'blue'},
  {to:'/training/',icon:GraduationCap,name:'新手实战带练',tag:'跟着做一次',copy:'用模拟客户练习选猫、报价和接待，进度随时保留。',items:'10步练习 / 场景反馈 / 可接着练',tone:'purple'},
  {to:'/assistant/',icon:Sparkles,name:'AI 销售导购',tag:'接住眼前的咨询',copy:'按真实库存挑猫，或带着猫咪编号起草微信回复。',items:'需求匹配 / 双猫对比 / 一键复制',tone:'green'},
];
export default function SupportPage(){return <div className="workspace-support">
  <div className="workspace-page-intro"><span className="workspace-eyebrow">销售支持</span><h1>把每一次接待，做得更从容。</h1><p>需要方法时查手册，想练习时跟着做，客户正在等你时打开 AI。</p></div>
  <div className="workspace-support-grid">{tools.map(({to,icon:Icon,name,tag,copy,items,tone})=><Link key={to} to={to} className={`workspace-tool ${tone}`}><div className="workspace-tool-top"><span><Icon size={23}/></span><small>{tag}</small><ArrowUpRight size={18}/></div><h2>{name}</h2><p>{copy}</p><footer><span>{items}</span><b>打开 <ArrowUpRight size={14}/></b></footer></Link>)}</div>
  <div className="workspace-support-note"><ShieldCheck size={19}/><div><b>所有推荐，都从真实资料出发。</b><p>库存、运费与售后需在成交前确认；未录入的骨相、性格和健康信息，请先向运营核实。</p></div></div>
  <div className="workspace-support-path"><span><MessageSquare size={17}/> 正在接待客户？</span><p>先看在售猫源，选中一只后点“写话术”，编号会自动带入。</p><Link to="/cats/">去挑猫 <ArrowUpRight size={15}/></Link></div>
</div>;}

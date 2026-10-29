// Manager -> specialist routing. Never hand the entire mixed tool request to
// each domain for reinterpretation. Existing UI and D1 task APIs are stable.
import {inventoryBrief} from './specialist-inventory.js';
import {designBrief} from './specialist-design.js';
export const SALES_SPECIALISTS=Object.freeze({match:'inventory',catalog:'inventory',poster:'design',single_poster:'design',downloads:'design',praise:'copy',price:'copy',compare:'copy',handbook:'coordinator',chat:'coordinator',calculator:'quote',order:'coordinator'});
export function specialistFor(tool){return SALES_SPECIALISTS[tool]||'coordinator';}
export function specialistForPlan(plan){return plan?.tool==='poster'&&plan?.params?.operation==='generate'?'copy':specialistFor(plan?.tool);}
export function createSpecialistBriefs(goal,catalog=[],modelDemand=null){
 return {inventory:inventoryBrief({goal,modelDemand,catalog}),design:designBrief({goal})};
}
export function annotateStep(plan,feedback={}){
 return {specialist:specialistForPlan(plan),tool:plan.tool,cat_ids:[...plan.cat_ids],...feedback};
}

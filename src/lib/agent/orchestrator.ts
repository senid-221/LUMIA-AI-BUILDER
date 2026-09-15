import { createBuildPlan } from "./planner";
export async function planBuild(request:string){const plan=await createBuildPlan(request);return{ok:true,phase:"PLANNED" as const,plan};}

import { NextResponse } from "next/server";
import { planBuild } from "@/lib/agent/orchestrator";
import { autonomousBuild } from "@/lib/agent/build-loop";
export const maxDuration=300;
export async function POST(request:Request){try{const body=await request.json();const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";if(!prompt)return NextResponse.json({ok:false,error:"A build request is required."},{status:400});const planned=await planBuild(prompt);const built=await autonomousBuild(prompt,planned.plan);return NextResponse.json({ok:true,plan:planned.plan,...built});}catch(error){console.error(error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Autonomous build failed."},{status:500});}}

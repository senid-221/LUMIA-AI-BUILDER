import { NextResponse } from "next/server";
import { planBuild } from "@/lib/agent/orchestrator";
export async function POST(request:Request){try{const body=await request.json();const prompt=typeof body?.prompt==="string"?body.prompt.trim():"";if(!prompt)return NextResponse.json({ok:false,error:"A build request is required."},{status:400});return NextResponse.json(await planBuild(prompt));}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Unable to create a build plan."},{status:500});}}

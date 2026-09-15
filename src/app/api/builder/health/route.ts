import { nvidiaConfigured } from "@/lib/ai/nvidia";
import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({ok:true,provider:"NVIDIA NIM",configured:nvidiaConfigured(),model:process.env.NVIDIA_MODEL||"qwen/qwen2.5-coder-32b-instruct",sandbox:"Docker isolated build runner"});}

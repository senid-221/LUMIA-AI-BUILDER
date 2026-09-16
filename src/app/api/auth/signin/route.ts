import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {createSession,verifyPassword} from "@/lib/auth";
export async function POST(req:Request){try{const {email,password}=await req.json(); const normalized=String(email||"").trim().toLowerCase(); const user=await prisma.user.findUnique({where:{email:normalized}}); if(!user||!user.passwordHash||!verifyPassword(String(password||""),user.passwordHash))return NextResponse.json({ok:false,error:"Invalid email or password"},{status:401}); await createSession(user.id); return NextResponse.json({ok:true,user:{id:user.id,email:user.email,name:user.name}})}catch(e){console.error(e);return NextResponse.json({ok:false,error:"Signin failed"},{status:500})}}

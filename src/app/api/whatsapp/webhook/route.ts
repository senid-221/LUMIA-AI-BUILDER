import { NextResponse } from "next/server";
import { nvidiaChat } from "@/lib/ai/nvidia";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url); const mode=url.searchParams.get("hub.mode"); const token=url.searchParams.get("hub.verify_token"); const challenge=url.searchParams.get("hub.challenge"); const expected=process.env.WHATSAPP_VERIFY_TOKEN;
  if(mode==="subscribe"&&token&&expected&&token===expected&&challenge)return new Response(challenge,{status:200});
  return NextResponse.json({error:"Webhook verification failed."},{status:403});
}

export async function POST(request: Request) {
  try {
    const body=await request.json(); const message=body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if(!message||message.type!=="text")return NextResponse.json({ok:true,ignored:true});
    const text=String(message.text?.body||"").trim(); if(!text)return NextResponse.json({ok:true,ignored:true});
    const phoneNumberId=process.env.WHATSAPP_PHONE_NUMBER_ID; const accessToken=process.env.WHATSAPP_ACCESS_TOKEN; const from=String(message.from||"");
    const config=await prisma.whatsAppAgentConfig.findFirst({where:{enabled:true},orderBy:{updatedAt:"desc"}});
    const instructions=config?.instructions||"You are Lumia AI WhatsApp Agent. Answer clearly and helpfully. Keep responses concise enough for WhatsApp.";
    const welcome=config?.welcome||"Hello! How can I help you today?";
    const result=await nvidiaChat([{role:"system",content:`${instructions}\nIf the user sends a greeting, use this welcome message as guidance: ${welcome}`},{role:"user",content:text}],{temperature:.3,maxTokens:700});
    if(!phoneNumberId||!accessToken||!from)return NextResponse.json({ok:true,reply:result.content,delivered:false,reason:"WhatsApp delivery credentials are not configured."});
    const response=await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`,{method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:from,type:"text",text:{body:result.content}}),cache:"no-store"});
    const data=await response.json().catch(()=>({})); if(!response.ok)return NextResponse.json({ok:false,error:data?.error?.message||`WhatsApp API error ${response.status}`},{status:502});
    return NextResponse.json({ok:true,delivered:true,messageId:data?.messages?.[0]?.id||null});
  } catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"WhatsApp webhook failed."},{status:500});}
}

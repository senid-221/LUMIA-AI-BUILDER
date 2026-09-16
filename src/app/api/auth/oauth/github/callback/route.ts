import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
function cookie(request:Request,name:string){return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1]}
export async function GET(request:Request){
 const url=new URL(request.url); const code=url.searchParams.get("code"); const state=url.searchParams.get("state");
 if(!code||!state||state!==cookie(request,"lumia_oauth_state_github")) return NextResponse.redirect(new URL("/?authError=Invalid+GitHub+OAuth+state",url.origin));
 const clientId=process.env.GITHUB_CLIENT_ID, clientSecret=process.env.GITHUB_CLIENT_SECRET;
 if(!clientId||!clientSecret) return NextResponse.redirect(new URL("/?authError=GitHub+OAuth+is+not+configured",url.origin));
 try{
  const token=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${url.origin}/api/auth/oauth/github/callback`})}).then(r=>r.json());
  if(!token.access_token) throw new Error("GitHub token exchange failed");
  const headers={Authorization:`Bearer ${token.access_token}`,Accept:"application/vnd.github+json","User-Agent":"Lumia-Builder"};
  const profile=await fetch("https://api.github.com/user",{headers}).then(r=>r.json()); let email=typeof profile.email==="string"?profile.email.toLowerCase():"";
  if(!email){const emails=await fetch("https://api.github.com/user/emails",{headers}).then(r=>r.json()); const primary=Array.isArray(emails)&&emails.find((x:any)=>x.primary&&x.verified); email=typeof primary?.email==="string"?primary.email.toLowerCase():""}
  if(!email) throw new Error("GitHub did not provide a verified email");
  const user=await prisma.user.upsert({where:{email},update:{name:profile.name||profile.login||null},create:{email,name:profile.name||profile.login||null}});
  await createSession(user.id);
  const response=NextResponse.redirect(new URL("/",url.origin)); response.cookies.set("lumia_oauth_state_github","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0}); return response;
 }catch(error){console.error(error);return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error instanceof Error?error.message:"GitHub login failed")}`,url.origin))}
}

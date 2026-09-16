import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
function cookie(request:Request,name:string){return request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1]}
export async function GET(request:Request){
 const url=new URL(request.url); const code=url.searchParams.get("code"); const state=url.searchParams.get("state");
 if(!code||!state||state!==cookie(request,"lumia_oauth_state_google")) return NextResponse.redirect(new URL("/?authError=Invalid+Google+OAuth+state",url.origin));
 const clientId=process.env.GOOGLE_CLIENT_ID, clientSecret=process.env.GOOGLE_CLIENT_SECRET;
 if(!clientId||!clientSecret) return NextResponse.redirect(new URL("/?authError=Google+OAuth+is+not+configured",url.origin));
 try{
  const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${url.origin}/api/auth/oauth/google/callback`,grant_type:"authorization_code"})}).then(r=>r.json());
  if(!token.access_token) throw new Error("Google token exchange failed");
  const profile=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${token.access_token}`}}).then(r=>r.json());
  const email=typeof profile.email==="string"?profile.email.toLowerCase():""; if(!email||profile.email_verified===false) throw new Error("Google did not provide a verified email");
  const user=await prisma.user.upsert({where:{email},update:{name:profile.name||null},create:{email,name:profile.name||null}});
  await createSession(user.id);
  const response=NextResponse.redirect(new URL("/",url.origin)); response.cookies.set("lumia_oauth_state_google","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0}); return response;
 }catch(error){console.error(error);return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error instanceof Error?error.message:"Google login failed")}`,url.origin))}
}

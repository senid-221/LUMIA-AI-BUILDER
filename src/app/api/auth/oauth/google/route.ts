import { NextResponse } from "next/server";
export async function GET(request: Request){
  const clientId=process.env.GOOGLE_CLIENT_ID;
  if(!clientId) return NextResponse.redirect(new URL("/?authError=Google+OAuth+is+not+configured",request.url));
  const url=new URL(request.url); const state=crypto.randomUUID(); const redirectUri=`${url.origin}/api/auth/oauth/google/callback`;
  const response=NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:"code",scope:"openid email profile",state,access_type:"online",prompt:"select_account"})}`);
  response.cookies.set("lumia_oauth_state_google",state,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:600}); return response;
}

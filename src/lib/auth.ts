import {createHash,randomBytes,pbkdf2Sync,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {prisma} from "@/lib/prisma";
const COOKIE="lumia_session"; const DAYS=30;
function hashToken(token:string){return createHash("sha256").update(token).digest("hex")}
export function hashPassword(password:string){const salt=randomBytes(16).toString("hex"); const key=pbkdf2Sync(password,salt,120000,32,"sha256").toString("hex"); return `${salt}:${key}`}
export function verifyPassword(password:string,stored:string){const [salt,key]=stored.split(":"); if(!salt||!key)return false; const actual=pbkdf2Sync(password,salt,120000,32,"sha256"); const expected=Buffer.from(key,"hex"); return expected.length===actual.length&&timingSafeEqual(expected,actual)}
export async function createSession(userId:string){const token=randomBytes(32).toString("hex"); const expiresAt=new Date(Date.now()+DAYS*86400000); await prisma.session.create({data:{userId,tokenHash:hashToken(token),expiresAt}}); const jar=await cookies(); jar.set(COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",expires:expiresAt,path:"/"}); return expiresAt}
export async function getCurrentUser(){const jar=await cookies(); const token=jar.get(COOKIE)?.value; if(!token)return null; const session=await prisma.session.findUnique({where:{tokenHash:hashToken(token)},include:{user:true}}); if(!session||session.expiresAt<=new Date()){if(session)await prisma.session.delete({where:{id:session.id}}); return null} return session.user}
export async function destroySession(){const jar=await cookies(); const token=jar.get(COOKIE)?.value; if(token){await prisma.session.deleteMany({where:{tokenHash:hashToken(token)}})} jar.delete(COOKIE)}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { feedback, role, contact } = body;
 if (!feedback?.trim()) {
 return NextResponse.json({ error: 'feedback required' }, { status: 400 });
 }
 // Email via simple mailto-style log — replace with SendGrid/Resend if needed
 console.log(`[KAIZEN] ${new Date().toISOString()} | Role: ${role} | Contact: ${contact}\n${feedback}`);
 return NextResponse.json({ ok: true });
 } catch {
 return NextResponse.json({ error: 'server error' }, { status: 500 });
 }
}

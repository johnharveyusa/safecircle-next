import { NextResponse } from 'next/server';

const KAIZEN_EMAIL = 'uscrimecenters@gmail.com'; // ← your feedback inbox

export async function POST(request: Request) {
  try {
    const { feedback, role, contact } = await request.json();
    if (!feedback?.trim()) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
    }

    // Use Resend if RESEND_API_KEY is set in Vercel env vars,
    // otherwise log to console (upgrade path is just adding the key)
    const apiKey = process.env.RESEND_API_KEY;

    if (apiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from:    'SafeCircle Feedback <onboarding@resend.dev>',
          to:      KAIZEN_EMAIL,
          subject: `💡 SafeCircle Feedback${role ? ` from ${role}` : ''}`,
          text: [
            `FEEDBACK:\n${feedback}`,
            role    ? `ROLE: ${role}`       : '',
            contact ? `CONTACT: ${contact}` : '',
            `TIME: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
          ].filter(Boolean).join('\n\n'),
        }),
      });
    } else {
      // No email key yet — log it so nothing is lost
      console.log('[KAIZEN FEEDBACK]', { feedback, role, contact, time: new Date().toISOString() });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Kaizen error:', err);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}

import nodemailer from 'nodemailer';
import { LINKEDIN_AUTHOR_PROFILE } from './content-dna';
import type { Draft, Topic } from './db';
import { baseUrl, env } from './env';

function transporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: env('GMAIL_USER'),
      pass: env('GMAIL_APP_PASSWORD'),
    },
  });
}

interface ImageAttachment { filename: string; cid: string; contentType: string; content: Buffer; }

async function send(subject: string, html: string, attachments?: ImageAttachment[]) {
  await transporter().sendMail({
    from: `"Agile Post Agent" <${env('GMAIL_USER')}>`,
    to: env('EMAIL_TO', env('GMAIL_USER')),
    subject,
    html,
    ...(attachments?.length ? { attachments } : {}),
  });
}

const shell = (title: string, body: string) => `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="margin:0 0 16px;font-size:18px">${title}</h2>
  ${body}
  <p style="color:#9ca3af;font-size:12px;margin-top:32px">Agile Post Agent · Vercel · replies to this email are not monitored</p>
</div>`;

const btn = (href: string, label: string, bg: string) =>
  `<a href="${href}" style="display:inline-block;padding:12px 20px;margin:4px 6px 4px 0;border-radius:8px;background:${bg};color:#fff;text-decoration:none;font-weight:600;font-size:15px">${label}</a>`;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline CID preview of the draft's generated image (+ attachment), or a fallback note. */
function imageBlock(d: Draft): { html: string; attachments?: ImageAttachment[] } {
  if (d.image_data && d.image_status === 'generated') {
    const ext = (d.image_mime || '').includes('jpeg') ? 'jpg' : 'png';
    return {
      html: `<h3 style="font-size:15px;margin:20px 0 8px;color:#374151">🎨 Image that will publish with the post</h3>
      <img src="cid:post-image" alt="Post illustration" style="display:block;width:100%;max-width:340px;border-radius:8px;border:1px solid #e5e7eb">`,
      attachments: [{ filename: `post-image.${ext}`, cid: 'post-image', contentType: d.image_mime || 'image/png', content: Buffer.from(d.image_data, 'base64') }],
    };
  }
  if (d.image_status === 'failed') {
    return { html: `<p style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:13px;margin:16px 0 4px">🎨 <strong>No image this week</strong> — image generation failed, so this post will publish <strong>text-only</strong>.</p>` };
  }
  return { html: '' };
}

/** Weekly email: 3 suggestions + 1 ready draft + action buttons. */
export async function sendDraftEmail(
  draft: Draft,
  links: { approve: string; pick2: string; pick3: string; feedback: string },
): Promise<void> {
  const topicsList = draft.topics
    .map(
      (t, i) =>
        `<li style="margin-bottom:8px"><strong>#${i + 1} ${esc(t.title)}</strong>${
          i === 0 ? ' <em>(drafted)</em>' : ''
        }<br><span style="color:#6b7280;font-size:13px">${esc(t.why)}${
          t.sourceUrl ? ` — <a href="${esc(t.sourceUrl)}" style="color:#2563eb">${esc(t.source)}</a>` : ''
        }</span></li>`,
    )
    .join('');

  const img = imageBlock(draft);

  await send(
    `🚀 Agile post ready — action needed (draft ${draft.id.slice(0, 8)})`,
    shell(
      'This week’s Agile LinkedIn draft is ready',
      `
      <h3 style="font-size:15px;margin:20px 0 8px;color:#374151">📈 Trending topics I found</h3>
      <ul style="padding-left:18px;margin:0 0 8px">${topicsList}</ul>
      <h3 style="font-size:15px;margin:20px 0 8px;color:#374151">✍️ Draft post (${esc(draft.chosen_topic)})</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc(draft.content)}</div>
      ${img.html}
      <p style="font-size:13px;color:#6b7280;margin:16px 0 4px">Approve, swap topic, or give feedback (links expire in 7 days):</p>
      ${btn(links.approve, '✅ Approve & Post', '#16a34a')}
      ${btn(links.pick2, '🔄 Try #2 instead', '#2563eb')}
      ${btn(links.pick3, '🔄 Try #3 instead', '#2563eb')}
      ${btn(links.feedback, '✏️ Give feedback', '#6b7280')}
      ${process.env.DRY_RUN !== 'false' ? '<p style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:13px;margin-top:12px">🧪 <strong>DRY-RUN mode is ON</strong> — approving will simulate the post, not publish it. Set <code>DRY_RUN=false</code> in Vercel to go live.</p>' : ''}
      `,
    ),
    img.attachments,
  );
}

export async function sendConfirmationEmail(draft: Draft, dryRun: boolean): Promise<void> {
  const img = imageBlock(draft);
  await send(
    dryRun ? '🧪 Dry-run complete (nothing published)' : '✅ Your LinkedIn post is live',
    shell(
      dryRun ? 'Dry run succeeded' : 'Published to LinkedIn',
      `<p>${dryRun ? 'DRY-RUN mode: the pipeline approved and “posted” <strong>without</strong> calling LinkedIn.' : 'Your draft was posted to your LinkedIn feed.'}</p>
       <blockquote style="border-left:3px solid #d1d5db;padding-left:12px;color:#4b5563;white-space:pre-wrap;font-size:14px">${esc(draft.content)}</blockquote>
       ${img.html}`,
    ),
    img.attachments,
  );
}

export async function sendFeedbackAckEmail(draft: Draft): Promise<void> {
  await send('🔄 New draft based on your feedback', shell(
    'Here’s your revised draft',
    `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px">${esc(draft.content)}</div>
     <p style="margin-top:16px">${btn(`${baseUrl()}/api/approve?token=PENDING`, '✅ Approve & Post', '#16a34a')}</p>
     <p style="font-size:13px;color:#6b7280">Use the buttons in the latest draft email to approve — each email carries its own signed links.</p>`,
  ));
}

export async function sendExpiryEmail(draft: Draft): Promise<void> {
  await send('⏰ Draft expired — no action taken', shell(
    'Your draft expired without approval',
    `<p>The draft for <strong>${esc(draft.chosen_topic)}</strong> was never approved and has been marked expired. Nothing was posted. Run the next Monday cycle for a fresh draft.</p>`,
  ));
}

export async function sendAlertEmail(subject: string, error: unknown): Promise<void> {
  const msg = error instanceof Error ? `${error.message}\n\n${error.stack ?? ''}` : String(error);
  await send(
    `⚠️ Agile Post Agent: ${subject}`,
    shell('Pipeline alert', `<pre style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:13px;overflow-x:auto">${esc(msg)}</pre>`),
  ).catch((e) => console.error('alert email failed:', e));
}

export async function sendTokenExpiryWarning(daysLeft: number): Promise<void> {
  await send('🔑 LinkedIn token expiring — re-auth needed', shell(
    'LinkedIn access token expiring soon',
    `<p>Your LinkedIn token expires in <strong>${daysLeft} days</strong>. Re-authorize to avoid missed posts:</p>
     <p>${btn(`${baseUrl()}/api/oauth/start`, '🔑 Re-connect LinkedIn', '#2563eb')}</p>`,
  ));
}

/** Signed action links for one draft version. */
export async function buildLinks(draft: Draft, tokens: { approve: string; feedback: string }) {
  const base = baseUrl();
  return {
    approve: `${base}/api/approve?token=${tokens.approve}`,
    pick2: `${base}/api/pick?token=${tokens.feedback}&n=2`,
    pick3: `${base}/api/pick?token=${tokens.feedback}&n=3`,
    feedback: `${base}/feedback?token=${tokens.feedback}`,
  };
}

export const signOff = `${LINKEDIN_AUTHOR_PROFILE.author.name} — ${LINKEDIN_AUTHOR_PROFILE.author.role}`;

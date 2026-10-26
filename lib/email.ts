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

async function send(subject: string, html: string) {
  await transporter().sendMail({
    from: `"Agile Post Agent" <${env('GMAIL_USER')}>`,
    to: env('EMAIL_TO', env('GMAIL_USER')),
    subject,
    html,
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

/** Weekly email: 3 suggestions + 1 ready draft + action buttons. */
export async function sendDraftEmail(
  draft: Draft,
  links: { approve: string; pick2: string; pick3: string; feedback: string; revise: string },
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

  await send(
    `🚀 Agile post ready — action needed (draft ${draft.id.slice(0, 8)})`,
    shell(
      'This week’s Agile LinkedIn draft is ready',
      `
      <h3 style="font-size:15px;margin:20px 0 8px;color:#374151">📈 Trending topics I found</h3>
      <ul style="padding-left:18px;margin:0 0 8px">${topicsList}</ul>
      <h3 style="font-size:15px;margin:20px 0 8px;color:#374151">✍️ Draft post (${esc(draft.chosen_topic)})</h3>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc(draft.content)}</div>
      <p style="font-size:13px;color:#6b7280;margin:16px 0 4px">Approve, swap topic, or tell me what to change (links expire in 7 days):</p>
      ${btn(links.approve, '✅ Approve & Post', '#16a34a')}
      ${btn(links.pick2, '🔄 Try #2 instead', '#2563eb')}
      ${btn(links.pick3, '🔄 Try #3 instead', '#2563eb')}
      ${reviseHint(links.revise)}
      ${process.env.DRY_RUN !== 'false' ? '<p style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:13px;margin-top:12px">🧪 <strong>DRY-RUN mode is ON</strong> — approving will simulate the post, not publish it. Set <code>DRY_RUN=false</code> in Vercel to go live.</p>' : ''}
      `,
    ),
  );
}

/**
 * Revision card shared by the draft and revision emails. It is real guidance, not just
 * decoration: the revision prompt instructs the model to treat the author's notes as
 * direction, so telling them what works makes the rewrite land closer to intent.
 */
function reviseHint(href: string): string {
  return `<div style="margin-top:16px;border:1px solid #e5e7eb;border-left:3px solid #6b7280;border-radius:8px;padding:14px 16px;background:#ffffff">
        <p style="margin:0 0 6px;font-size:14px;font-weight:600">✏️ Want it changed? Tell me what to fix</p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">I'll rewrite the post and email you the new version — approve that one when it's right.</p>
        <ul style="margin:0 0 12px;padding-left:18px;font-size:13px;color:#4b5563">
          <li>What to change — too long, wrong angle, add a number</li>
          <li>The story to use — or drop the personal anecdote</li>
          <li>The takeaway you want readers to act on</li>
          <li>Ask for a completely different topic — e.g. “write about estimation instead, not AI”</li>
        </ul>
        ${btn(href, '✏️ Give feedback / pick another topic', '#6b7280')}
      </div>`;
}

export async function sendConfirmationEmail(draft: Draft, dryRun: boolean): Promise<void> {
  await send(
    dryRun ? '🧪 Dry-run complete (nothing published)' : '✅ Your LinkedIn post is live',
    shell(
      dryRun ? 'Dry run succeeded' : 'Published to LinkedIn',
      `<p>${dryRun ? 'DRY-RUN mode: the pipeline approved and “posted” <strong>without</strong> calling LinkedIn.' : 'Your draft was posted to your LinkedIn feed.'}</p>
       <blockquote style="border-left:3px solid #d1d5db;padding-left:12px;color:#4b5563;white-space:pre-wrap;font-size:14px">${esc(draft.content)}</blockquote>`,
    ),
  );
}

export async function sendFeedbackAckEmail(draft: Draft, links: { approve: string; revise: string }): Promise<void> {
  await send('🔄 New draft based on your feedback', shell(
    'Here’s your revised draft',
    `<p style="font-size:14px;color:#4b5563;margin:0 0 12px">Rewritten to match your notes. Nothing is posted until you approve this version — the older email’s buttons are stale, so use the two below.</p>
     <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.5">${esc(draft.content)}</div>
     <p style="margin-top:16px">${btn(links.approve, '✅ Approve & Post', '#16a34a')}${btn(links.revise, '✏️ Give feedback again', '#6b7280')}</p>
     ${process.env.DRY_RUN !== 'false' ? '<p style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;font-size:13px;margin-top:12px">🧪 <strong>DRY-RUN mode is ON</strong> — approving will simulate the post, not publish it.</p>' : ''}`,
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
export async function buildLinks(draft: Draft, tokens: { approve: string; feedback: string; revise?: string }) {
  const base = baseUrl();
  // Older callers (and already-sent emails) only carry a `feedback` token; the
  // feedback page checks its own 'feedback' action, so reusing it degrades safely.
  const revise = tokens.revise ?? tokens.feedback;
  return {
    approve: `${base}/api/approve?token=${tokens.approve}`,
    pick2: `${base}/api/pick?token=${tokens.feedback}&n=2`,
    pick3: `${base}/api/pick?token=${tokens.feedback}&n=3`,
    feedback: `${base}/feedback?token=${tokens.feedback}`,
    revise: `${base}/feedback?token=${revise}`,
  };
}

export const signOff = `${LINKEDIN_AUTHOR_PROFILE.author.name} — ${LINKEDIN_AUTHOR_PROFILE.author.role}`;

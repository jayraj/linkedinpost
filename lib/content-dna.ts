/**
 * CONTENT DNA — the AI writes in YOUR voice using this profile.
 * (Filled in — tweak anything here and push; the next draft picks it up.)
 */
export const CONTENT_DNA = {
  /** 1–2 sentences: a real Agile moment from your experience the posts draw from. */
  personalStory:
    'Our releases were quarterly and always slipped. I killed two status meetings, split the work into two-week slices, and within a month we were shipping bi-weekly — same team, same budget, fewer headaches.',

  /** What you promote + where the CTA points. */
  service: {
    name: 'Author’s personal brand — no client service yet',
    blurb:
      'Soft CTA: invite readers to follow the author for one sharp, practical Agile take every week — no product pitch',
    ctaUrl:
      'none — use a text-only CTA such as "Follow me for weekly Agile takes" (replace this with your real service + https:// link when you have one)',
  },

  /** The sharp, contrarian, exec-facing take that anchors your point of view. */
  signatureOpinion: 'Most teams don’t have an Agile problem — they have a courage problem.',

  /** Post sign-off. */
  signOff: {
    name: 'Jayraj Bhatta',
    title: 'Engineering Manager specializing in Agile delivery',
  },

  audience: 'Leadership / executives',
  tone: 'Short & punchy (~150 words), zero jargon soup, concrete numbers where possible',
} as const;

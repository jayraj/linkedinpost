/**
 * CONTENT DNA — the AI writes in YOUR voice using this profile.
 *
 * ⚠️  TBD PLACEHOLDERS — fill these in before go-live (Phase 0, plan §11)!
 *     Until they're filled, generated drafts will contain visible [TBD] markers.
 */
export const CONTENT_DNA = {
  /** 1–2 sentences: a real Agile moment from your experience the posts draw from. */
  personalStory:
    '[TBD — personal Agile story: e.g. "Led a program where we cut release cycles from quarterly to bi-weekly by killing status meetings and shipping small."]',

  /** What you promote + where the CTA points. */
  service: {
    name: '[TBD — company/service name]',
    blurb: '[TBD — one line: what it does / who it helps]',
    ctaUrl: '[TBD — https:// link]',
  },

  /** The sharp, contrarian, exec-facing take that anchors your point of view. */
  signatureOpinion: '[TBD — e.g. "Agile isn\'t about going faster — it\'s about failing cheaper."]',

  /** Post sign-off. */
  signOff: {
    name: '[TBD — your name]',
    title: '[TBD — your title]',
  },

  audience: 'Leadership / executives',
  tone: 'Short & punchy (~150 words), zero jargon soup, concrete numbers where possible',
} as const;

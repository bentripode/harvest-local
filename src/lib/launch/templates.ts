/**
 * Copy a seller can send, for the moments they'll actually need one.
 *
 * These are OUR words, so they are held to the same bar as anything the writing assistant produces —
 * `test/launch-templates.test.ts` runs every one of them through `screenCopy` and fails on a block.
 * It would be an odd marketplace that refuses a seller "gluten-free" and then hands them a template
 * saying it.
 *
 * The harder discipline is that a template must not put words in a seller's mouth about **facts we
 * do not have**. No template says what they make, how long they have been doing it, or that anything
 * is delicious — those are theirs. What a template can do is the awkward structural part: the
 * opening line, the ask, the link. The seller supplies the substance, which is also why every one of
 * these is short enough to read in one go and edit before sending.
 */

export interface TemplateSource {
  businessName: string;
  storefrontUrl: string;
  stateName: string;
  /** Their own one-liner, if they've written one. Used verbatim, never rewritten. */
  bio: string | null;
  /** A referral code, where they have one. */
  promoCode: string | null;
  /** Buyer discount attached to that code, as a whole percent. */
  promoPercent: number | null;
}

export interface LaunchTemplate {
  id: string;
  title: string;
  /** When to send it. */
  when: string;
  body: string;
  /** Said above the box, where there's something the seller must fill in or check. */
  note?: string;
}

/**
 * A blank is left as a bracketed prompt rather than filled with a plausible guess.
 *
 * "[what you make]" is obviously the seller's job. A cheerful invented "fresh sourdough and
 * seasonal preserves" would be a sentence about their business that nobody at their business
 * wrote, and some of them would send it unread.
 */
export function launchTemplates(source: TemplateSource): LaunchTemplate[] {
  const { businessName, storefrontUrl, stateName, bio } = source;
  const line = bio?.trim() ? bio.trim() : "[a sentence about what you make]";

  const templates: LaunchTemplate[] = [
    {
      id: "friends",
      title: "Telling people you know",
      when: "The day you go live. This is the one that actually gets you your first order.",
      body: [
        `I've opened a little online shop for ${businessName}.`,
        "",
        line,
        "",
        `Everything is collected locally — you can see what I have here: ${storefrontUrl}`,
        "",
        "No pressure at all, but if you know anyone nearby who'd like it, sending this on would help me more than you'd think.",
      ].join("\n"),
    },
    {
      id: "social",
      title: "A post for wherever you post",
      when: "Once you have a couple of listings up and a date people can collect.",
      body: [
        `${businessName} is now taking orders online.`,
        "",
        line,
        "",
        `Order and arrange collection here: ${storefrontUrl}`,
      ].join("\n"),
      note: "Add a photo of something you've actually made — it does more than any wording will.",
    },
    {
      id: "stall",
      title: "A card for your stall or your jars",
      when: "Print it small and keep a stack in your bag.",
      body: [
        businessName,
        line,
        "",
        `Order for collection: ${storefrontUrl}`,
      ].join("\n"),
      note: "Your QR code prints the same link — most people will scan rather than type it.",
    },
    {
      id: "first-order",
      title: "After someone's first order",
      when: "When you hand it over, or the evening after.",
      body: [
        "Thanks for ordering — I hope it was good.",
        "",
        "If you have a minute, a review on my page helps more than almost anything else; it's the first thing a new buyer looks at.",
        "",
        "Either way, thank you for being one of the first.",
      ].join("\n"),
      note: "Only buyers with a completed order can leave a review, so this is the right moment to ask.",
    },
    {
      id: "market",
      title: "Telling people where you'll be",
      when: "Whenever you've added a market day or a pop-up.",
      body: [
        `${businessName} will be at [where], [when].`,
        "",
        "You can order ahead for collection there, or just come and find me:",
        storefrontUrl,
      ].join("\n"),
    },
  ];

  if (source.promoCode && source.promoPercent) {
    templates.push({
      id: "referral",
      title: "Sharing your referral code",
      when: "Anywhere you'd mention the shop. It's what earns you a free month.",
      body: [
        `If you're ordering from ${businessName} for the first time, ${source.promoCode} takes ${source.promoPercent}% off.`,
        "",
        storefrontUrl,
      ].join("\n"),
      note: `Three buyers using it in a billing cycle earns you a free month. ${stateName} buyers only — orders stay inside one state.`,
    });
  }

  return templates;
}

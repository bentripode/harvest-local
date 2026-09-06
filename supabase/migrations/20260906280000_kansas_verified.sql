-- Harvest Local — Kansas, from K.S.A. 65-689(a), (d), (e), (f) and Kan. Admin. Regs. 4-28-33, read
-- 2026-09-06.
--
-- Kansas has no cottage food law. What it has is a licensing exemption, one sentence long, and a
-- regulation of hygiene for the people who fall inside it. K.S.A. 65-689(d)(4):
--
--   "A license shall not be required by: ... (4) A person who produces food for distribution
--   directly to the end consumer, if such food does not require time and temperature control for
--   safety or specialized processing, as determined by the secretary."
--
-- Everything our row asserts about Kansas has to come out of that sentence or out of K.A.R. 4-28-33,
-- and several things did not.
--
-- =========================================================================
-- 1. THERE IS NO STATE LABELLING RULE IN THESE SOURCES
-- =========================================================================
-- The label row carried five elements and a note reading "Quantity may be net weight, volume or
-- count depending on the product. No disclaimer is required." The second sentence is right and the
-- first has no source: neither 65-689 nor 4-28-33 says anything about a label. 4-28-33 is headed
-- "Sanitation and hygiene requirements for exempt food establishments" and stays on that subject
-- throughout — contamination, warewashing, potable water, bare-hand contact, employee illness.
--
-- The five elements are kept, because they are what federal law requires of packaged food anyway
-- (21 CFR 101: identity, ingredients, net quantity, and the name and place of business of the
-- manufacturer or packer), and because removing them would print a Kansas label carrying less than
-- a buyer is entitled to. But the note now says plainly that they are the federal requirements
-- rather than a Kansas one, and that Kansas's own misbranding provisions have not been read. That is
-- the difference between a rule we checked and a rule we inherited.
--
-- No disclaimer is genuinely required, which makes Kansas unusual and is worth stating rather than
-- leaving as a null.
--
-- =========================================================================
-- 2. "SPECIALIZED PROCESSING, AS DETERMINED BY THE SECRETARY" IS THE HOOK
-- =========================================================================
-- The exemption has two limbs. The first — food that "does not require time and temperature control
-- for safety" — is the familiar one and supports `cat_refrigerated = banned`.
--
-- The second is a delegation with no determination attached in these sources. `cat_acidified` and
-- `cat_fermented` were banned, and the only thing that could ban them is a secretary's
-- determination that they require specialized processing. That determination has not been located,
-- so both become `unclear`: we do not know, and saying so is better than asserting either way.
-- `cat_low_acid_canned` stays banned — low-acid canning is the paradigm case of specialized
-- processing, and it is the axis where being wrong is dangerous.
--
-- =========================================================================
-- 3. TWO NOTES CITED FIGURES THAT ARE NOT IN THESE SOURCES
-- =========================================================================
-- `category_note` read "Fish, seafood, under 1,000 personally-raised poultry and 250 rabbits" and
-- `recipe_note` read "Canned foods only". Neither figure nor phrase appears in 65-689 or 4-28-33.
-- They are the summary's. The values (`conditional` on both) are left alone, because neither blocks
-- a listing and the underlying shape is plausible, but the notes now say where the operative test
-- actually lives.
--
-- =========================================================================
-- 4. WHAT THE EXEMPT SELLER ACTUALLY OWES
-- =========================================================================
-- K.A.R. 4-28-33 is a real set of obligations and our data had nowhere to put them. They are
-- recorded in `license_note` because a Kansas seller reading "no licence required" would otherwise
-- have no idea that annual water testing and a documented sanitizing routine come with it.
--
-- `verified_at` stays null.

set search_path = public;

update public.state_label_rules set
  required_elements = array[
    'product_name', 'producer_name', 'producer_address', 'ingredients_desc_by_weight', 'net_weight'
  ],
  disclaimer_text = null,
  notes =
    'NO KANSAS LABELLING RULE EXISTS IN THE SOURCES READ (K.S.A. 65-689(a), (d), (e), (f) and Kan. '
    'Admin. Regs. 4-28-33, read 2026-09-06). 65-689 is about licences; 4-28-33 is headed "Sanitation '
    'and hygiene requirements for exempt food establishments" and never leaves that subject. NO '
    'DISCLAIMER IS REQUIRED — genuinely, not merely unrecorded, which makes Kansas unusual among the '
    'states checked so far. The five elements here are kept but are NOT a Kansas requirement: they '
    'are what federal law asks of packaged food anyway (21 CFR 101 — identity, ingredients, net '
    'quantity, and the name and place of business of the manufacturer, packer or distributor), and '
    'printing them gives a Kansas buyer what a buyer anywhere else gets. Kansas''s own misbranding '
    'provisions in the food, drug and cosmetic act have not been read and may add to this list. The '
    'previous note said "Quantity may be net weight, volume or count depending on the product", '
    'which is the federal rule rather than a state one and is true either way.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kansas.pdf',
  source_checked_at = '2026-09-06'
where program_id in (
  select id from public.state_food_programs where state_code = 'KS' and ordinal = 1
)
and verified_at is null;

update public.state_food_programs set
  name = 'Unlicensed Direct-to-Consumer Food',
  -- The exemption is for food "for distribution directly to the end consumer".
  direct_delivery = 'allowed',
  -- Only a secretary's determination on "specialized processing" could ban these, and no such
  -- determination appears in the sources read.
  cat_acidified = 'unclear',
  cat_fermented = 'unclear',
  -- Not addressed in either source.
  local_preemption = null,
  venue_note =
    'A LICENSING EXEMPTION, NOT A COTTAGE FOOD LAW, and it does carry a channel condition — the row '
    'previously said "No restrictions". K.S.A. 65-689(a) makes it "unlawful for any person to engage '
    'in the business of conducting a food establishment or food processing plant unless such person '
    'shall have in effect a valid license", and (d)(4) exempts "A person who produces food for '
    'distribution DIRECTLY TO THE END CONSUMER, if such food does not require time and temperature '
    'control for safety or specialized processing, as determined by the secretary." Direct '
    'distribution is a condition of the exemption, which is why retail_allowed is false. ONLINE '
    'SELLING IS NOT MENTIONED in either source; online_orders stays allowed because the condition is '
    'about WHO receives the food, not how it travels, and nothing confines sales to a venue — an '
    'inference from silence plus a permissive frame, as in Georgia, not an express permission like '
    'Florida''s or Indiana''s.',
  mail_note =
    'Not mentioned in either source. Allowed on the same reasoning as online orders: 65-689(d)(4) '
    'conditions the exemption on distribution "directly to the end consumer", which a parcel to that '
    'consumer satisfies.',
  category_note =
    'THE PREVIOUS NOTE — "Fish, seafood, under 1,000 personally-raised poultry and 250 rabbits" — '
    'appears nowhere in K.S.A. 65-689 or K.A.R. 4-28-33 and is the summary''s. The operative test is '
    'the two-limbed condition in 65-689(d)(4): the food must not "require time and temperature '
    'control for safety" (which is what bans refrigerated food here, and which excludes most meat '
    'in most forms) and must not require "specialized processing, AS DETERMINED BY THE SECRETARY". '
    'That second limb is a delegation, and no determination under it appears in these sources. '
    'Acidified and fermented food are therefore unclear rather than banned — only such a '
    'determination could ban them. Low-acid canning stays banned as the paradigm case of '
    'specialized processing. cat_meat is left conditional because the shape is plausible and it '
    'blocks nothing, but the figures behind it are unverified.',
  recipe_note =
    'The previous note read "Canned foods only", which is not in these sources. What 65-689(d)(4) '
    'actually does is condition the exemption on the food not requiring "specialized processing, as '
    'determined by the secretary" — a determination by the department rather than an approval the '
    'seller applies for, and one this pass has not located.',
  license_note =
    'NO LICENCE, BUT REAL OBLIGATIONS. The exemption is K.S.A. 65-689(d)(4). Inspection is '
    'complaint-triggered: (e), "The exemption provided to those entities provided in subsection (d) '
    'shall not be exempt from inspection or regulation when a violation is observed or reported to '
    'the secretary." AND KAN. ADMIN. REGS. 4-28-33 STILL BINDS an exempt establishment, which a '
    'seller told "no licence required" would not guess. It requires food preparation areas '
    '"protected from environmental contamination, including rain, dust, and pests"; food contact '
    'surfaces cleaned, rinsed and sanitized "by immersing each item in a chlorine bleach solution of '
    '50 to 100 parts per million for 10 seconds and allowing the item to air-dry" or an equivalent '
    'labelled sanitizer, with warewashing in "easily cleanable sinks or food-grade tubs"; no animals '
    'in food preparation areas; a potable water supply, and where it comes from a well or spring, '
    'ANNUAL TESTING by the operator to nitrates under 20 mg/kg and zero total and faecal coliforms, '
    'with the current copy available on request; approved sewage disposal; no bare-hand contact with '
    'ready-to-eat food; a prescribed handwashing procedure; and exclusion from food work of anyone '
    'with vomiting, diarrhoea, jaundice, sore throat with fever, certain open lesions, or norovirus, '
    'hepatitis A, shigella or enterohaemorrhagic E. coli. No revenue cap appears in either source.',
  training_note =
    'None required. K.A.R. 4-28-33 prescribes practices — handwashing, sanitizing, illness exclusion '
    '— but no certification, course or proof of training.',
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Kansas.pdf',
  source_checked_at = '2026-09-06'
where state_code = 'KS' and ordinal = 1 and verified_at is null;

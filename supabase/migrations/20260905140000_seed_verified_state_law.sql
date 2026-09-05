-- Harvest Local — carry the verified state figures in the migrations, not just in one database.
--
-- Between 2026-09-05 and this migration, 46 of the 51 state rows and 4 program rows were checked
-- against each state's own statute or administrative code and corrected. That work lived only in
-- the hosted dev project: `state_cottage_food_rules` and `state_food_programs` are admin-edited
-- data, so `supabase db reset` — or standing up production — would have thrown all of it away and
-- put every state back on the invented $50,000 placeholder.
--
-- Two corrections here were not cosmetic:
--
--   * WASHINGTON had `online_orders = 'allowed'`. RCW 69.22.020(4): "Cottage food products may
--     only be sold directly to the consumer and may not be sold by internet, mail order, or for
--     retail sale outside the state." The seed would have let a Washington seller list food here
--     in breach of the statute.
--   * VIRGINIA had online and mail BANNED and a $3,000 acidified-only per-category cap. Va. Code
--     3.2-5130(3) and (4) both permit sale "at any location, through the internet, or by phone"
--     and both cap at $9,000. That one blocked lawful sellers.
--
-- `verified_at` is deliberately NOT set. It records that a PERSON checked the row against the
-- state's rules, and that is per-environment: seeding an attestation would be forging one. What
-- this migration seeds is the FIGURE and the CITATION, so a fresh environment starts from sourced
-- law rather than a placeholder, and an admin's job becomes confirming rather than researching.
--
-- Every statement is guarded on `verified_at is null`, so a row a human has already attested to
-- is never overwritten by this file.

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. State rows — the cap and licence position, with the citation in the notes.
-- ---------------------------------------------------------------------------

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Alaska Stat. 17.20.332-.338 (homemade food), read 2026-09-05 via codes.findlaw.com. No sales cap in the statute. No licence or permit: "a homemade food produced, sold, and consumed in compliance with this section is exempt from state labeling, licensing, packaging, permitting, and inspection requirements." Prohibited: seafood, game meat, rendered animal fat, controlled substances; meat is allowed under subsection (h). Sales must occur in state at an enumerated venue or "a location agreed on between the producer and the buyer"; the statute does not name internet sales either way, so the online status is recorded as unclear rather than read into it.'
where state_code = 'AK' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against AL Code 22-20-5.1 and Ala. Admin. Code r. 420-3-22-.01, read 2026-09-05 in the National Agricultural Law Center compilation (current through Register Vol. 43 No. 3, 31 Dec 2024). No sales cap: the section sets none (the earlier $20,000 limit is gone). No permit: subsection (b) "A cottage food production operation is not a food service establishment and is not required to have a food service permit issued by the county health department", and (c) bars the State Department of Public Health and county health departments from regulating production. A food safety course approved by the department IS required - that is training, not a licence. Sales must be direct to consumers in the state, "whether in-person, by phone, or online", and delivery within the state may be in person, by an agent, or by mail. Excludes meat, poultry and fish.'
where state_code = 'AL' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Ark. Code Ann. 20-57-501 to -507 (Food Freedom Act), read 2026-09-05 in the National Agricultural Law Center compilation (current through the 2024 Second Extraordinary Session). No sales cap: the subchapter sets none. No licence: 20-57-504(a) "homemade food or drink products produced and sold in compliance with this subchapter are exempt from state licensure, certification, inspection, and packaging and labeling requirements." Sales must be direct to an informed end consumer but may run through an agent or a third-party vendor, may be made in person, by telephone or online, and may be delivered by the producer, an agent, a third-party vendor or a third-party carrier. Prohibited: meat, poultry, seafood and time/temperature control for safety foods.'
where state_code = 'AR' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against Ariz. Rev. Stat. 36-136 and 36-931 to -933, read 2026-09-05 in the National Agricultural Law Center compilation (current through L. 2024 ch. 259 / Register Vol. 31 No. 2). No sales cap: the cottage food sections set none. Registration IS required: 36-931(1)(a) defines a cottage food product as one prepared "by or under the direct supervision of an individual who is registered with the department", and 36-136(I)(13) requires the department to keep an online registry, with "A registered food preparer shall renew the registration every three years." Arizona permits potentially hazardous / TCS cottage foods, unlike most states. Excludes alcohol, unpasteurized milk, fish and shellfish, meat and poultry unless federal law allows.'
where state_code = 'AZ' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 75000,
  requires_license = true,
  notes = 'Verified against Cal. Health & Saf. Code 113758, read 2026-09-05 in the National Agricultural Law Center compilation. Two cottage food tiers: "A Class A cottage food operation shall not have more than seventy-five thousand dollars ($75,000) in verifiable gross annual sales. A Class B cottage food operation shall not have more than one hundred fifty thousand dollars ($150,000)", both "annually adjusted for inflation based on the California Consumer Price Index". This row records the LOWER figure because it is the fallback used when a seller has not told us which programme they are on - pausing a Class B seller early is the safe error, and choosing a programme makes it exact. MEHKO is a separate programme again. Registration or a permit is required (the statute speaks of the "registered or permitted area" of the home); Class A registers, Class B is permitted.'
where state_code = 'CA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 150000,
  requires_license = true,
  notes = 'Verified against Colo. Rev. Stat. 25-4-1602 and 25-4-1614, read 2026-09-05 in the National Agricultural Law Center compilation (current through the 2026 Regular Session, effective 4 June 2026). Cap: "This section applies only to producers that earn gross revenues of one hundred fifty thousand dollars or less per calendar year from the sale of food permitted under this section", CPI-adjusted annually for Denver-Aurora-Lakewood. NOTE: the current text contains no per-product limit and no $10,000 figure - our seeded per-product cap for Colorado appears to be out of date. Registration is required: the label must carry "the producers name, department-issued registration number". Sales must be in Colorado only and must not involve interstate commerce.'
where state_code = 'CO' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 50000,
  requires_license = true,
  notes = 'Verified against Conn. Gen. Stat. 21a-62b to 21a-62h, read 2026-09-05 in the National Agricultural Law Center compilation. Cap: 21a-62d(a) "Total annual gross sales for a cottage food operation shall not exceed fifty thousand dollars per calendar year", and above it the operator must obtain a food manufacturing establishment licence or cease. Licence required: 21a-62c(a) "All cottage food operations shall be licensed annually by the Commissioner of Consumer Protection", annual fee capped at $100, with an examination of the premises before licensing, potable-water testing where the supply is private, and a completed food safety training programme.'
where state_code = 'CT' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against the Delaware Cottage Food Regulations made under 16 Del. C. 122, read 2026-09-05 in the National Agricultural Law Center compilation. No revenue cap: the regulations limit sales channels rather than turnover. Registration IS required - "Annual registration fees will be in the amount of $30 per CFE", the year running 1 April to 31 March, with inspections to verify the operation matches its registration application. Critically for this marketplace: "3.1.3.2 Online sales are not permitted. Online advertising and marketing are permitted." Direct sales to consumers in Delaware only; no wholesale or sales to resellers.'
where state_code = 'DE' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 250000,
  requires_license = false,
  notes = 'Verified against Fla. Stat. 500.80, read 2026-09-05 in the National Agricultural Law Center compilation. Cap: a cottage food operation "is exempt from the permitting requirements of s. 500.12 if the cottage food operation complies with this section and has annual gross sales of cottage food products that do not exceed $250,000", counted across all locations and product types. No permit below that figure - the cap and the exemption are the same sentence, so crossing it means permitting, not merely a pause. Distinctly permissive on channel: "A cottage food operation may sell, offer for sale, and accept payment for cottage food products over the Internet or by mail order", with delivery in person, to an event venue, or by USPS or commercial mail service. No wholesale.'
where state_code = 'FL' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against Ga. Comp. R. & Regs. 40-7-19, read 2026-09-05 in the National Agricultural Law Center compilation (current through rules filed 18 Dec 2024). No revenue cap: the chapter sets none. A licence IS required: "License means the document issued by the Department that authorizes a cottage food operator to produce cottage food products in their home kitchen", and the rules warn it "should not be considered a loophole or alternative to the Food Establishment License". Limited to non-potentially-hazardous foods.'
where state_code = 'GA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Haw. Admin. Rules 11-50-2, 11-50-3, 11-50-31 and 11-50-35, read 2026-09-05 in the National Agricultural Law Center compilation (current through November 2024). No revenue cap. No permit, on this reading: 11-50-3(a) requires a permit to operate a food establishment "except as otherwise provided in this section", and (c) provides that an operation producing or packaging only homemade food products in a home kitchen "shall be exempt from the provisions of this chapter" - the permit requirement being one of them. It is an exemption FROM the chapter rather than an express words-of-exemption from permitting, so treat this one as the interpretive call it is. Inspection under 11-50-8 still applies and food safety certification is still required. Homemade food products exclude fermented, acidified, canned or bottled foods, dried meats or seafood, low acid canned foods and garlic in oil.'
where state_code = 'HI' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Iowa Code 137D and 137F.1, read 2026-09-05 in the National Agricultural Law Center compilation. Iowa runs two routes. A cottage food operation under 137F sells food produced at a private residence that is not time/temperature control for safety, and needs no licence. A "home food processing establishment" under 137D is a residence business "if the business has gross annual sales of less than fifty thousand dollars", and 137D.2 provides "A person shall not open or operate a home food processing establishment until a license has been obtained from the department", fee $50, renewed annually. This fallback row records the cottage food route - no cap, no licence - because demanding a permit of a plain non-TCS baker who needs none is the error we are trying to avoid. A seller doing canned or TCS goods belongs on the 137D route; choosing a programme makes that exact.'
where state_code = 'IA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Idaho Code 37-201 to 37-208 (Idaho Direct-to-Consumer Commerce Act), read 2026-09-05 in the National Agricultural Law Center compilation (current through 1 July 2026). No cap. No licence, stated on the face of the required label: "This product is not subject to government food safety inspection or licensing requirements." Homemade is defined as prepared at a "non-licensed facility", and 37-204 preempts local licensing or permitting more stringent than state or federal law. Transactions must occur entirely within Idaho and must not involve interstate commerce. Perishable and time/temperature-controlled foods ARE permitted, which is unusual. Meat is excluded except poultry where the producer slaughters no more than 1,000 birds of their own raising per year.'
where state_code = 'ID' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against 410 ILCS 625/3.6 and 625/4, read 2026-09-05 in the National Agricultural Law Center compilation. Two distinct routes and they must not be confused. A "home kitchen operation" is exempt from the Act but only where "Monthly gross sales do not exceed $1,000" and only for non-potentially-hazardous baked goods. A "cottage food operation" has no revenue cap in the current text, but "must register with the local health department for the unit of local government in which it is located", and the local health department "shall issue a certificate of registration with an identifying registration number". This row records the cottage food route: no cap, registration required.'
where state_code = 'IL' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Ind. Code 16-42-5.3 (home based vendor), read 2026-09-05 in the National Agricultural Law Center compilation. No cap: the chapter sets none. No licence: section 3 provides "The production and sale of food products by a home based vendor in accordance with this chapter are exempt from the requirements of this title that apply to food establishments", and section 12 is headed "Prohibition on an Ordinance or Resolution Requiring Licensure, Certification, or Inspection", barring local units of government from imposing them.'
where state_code = 'IN' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against K.S.A. 65-689 and Kan. Admin. Regs. 4-28-33, read 2026-09-05 in the National Agricultural Law Center compilation (current through Register Vol. 43 No. 52). No cap. No licence: 65-689(a) makes it unlawful to run a food establishment without a licence, but (d) provides "A license shall not be required by: ... (4) A person who produces food for distribution directly to the end consumer, if such food does not require time and temperature control for safety or specialized processing, as determined by the secretary." Under (e) that exemption does not prevent inspection where a violation is observed or reported, and Kan. Admin. Regs. 4-28-33 still imposes sanitation and hygiene requirements on exempt establishments.'
where state_code = 'KS' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 60000,
  requires_license = true,
  notes = 'Verified against KRS 217.015 and the home-based processor provisions, read 2026-09-05 in the National Agricultural Law Center compilation. Cap: a home-based processor is one "who has a gross income of no more than sixty thousand dollars ($60,000) annually from the sale of the products"; the same $60,000 figure applies to a home-based microprocessor. Registration IS required: "Beginning January 1, 2020, a home-based processor shall register with the Department for Public Health, Food Safety Branch", submitting a DFS-250 application and "A fifty (50) dollar registration fee". A home-based processor is exempt from KRS 217.035 and 217.037 only if the labelling and adulteration conditions are met. The microprocessor route additionally requires certification through the Kentucky Cooperative Extension Service microprocessing programme.'
where state_code = 'KY' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 30000,
  requires_license = false,
  notes = 'Verified against La. Rev. Stat. 40:4.9 (low-risk foods prepared in the home), read 2026-09-05 in the National Agricultural Law Center compilation. No licence: subsection A disapplies the state Sanitary Code and any other law requiring particular equipment, design, construction, utensils, supplies, preparation or services. Cap $30,000, but note the shape of it: "This Section shall not apply to any preparer of low-risk foods made at a home for sale, whose gross annual sales equal thirty thousand dollars or more." It is the point at which the exemption stops applying, not a ceiling you may sit on - at $30,000 exactly the exemption is already gone. Resale to a retail business is prohibited.'
where state_code = 'LA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against 105 Mass. Code Regs. 590.001 and 590.010, read 2026-09-05 in the National Agricultural Law Center compilation (current through Register 1537). No revenue cap. A licence IS required, and it follows from the definitions rather than a dedicated cottage food section: 590.001 includes a "residential kitchen for a cottage food operation" within the meaning of food establishment, so the permit requirement applies. The residential-kitchen exemptions that do exist are for a religious or charitable bake sale and for food distributed to a charitable facility, not for commercial cottage food. Massachusetts is also one of the states whose labelling rule we have not recorded.'
where state_code = 'MA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Md. Code, Health-Gen. 21-330.1 and Md. Code Regs. 10.15.03.27, read 2026-09-05 in the National Agricultural Law Center compilation (current through Register Vol. 51 No. 26). No licence: 21-330.1(b) "A cottage food business is not required to be licensed by the Department if the owner of the cottage food business complies with this section." No revenue cap appears in either the statute or the regulation. Sales are confined to the State and to defined channels - at a retail food store subject to conditions, or directly to a consumer.'
where state_code = 'MD' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against Me. Stat. tit. 7 281-286 (Maine Food Sovereignty Act), tit. 30-A 7505 and 01-001-345 Me. Code R., read 2026-09-05 in the National Agricultural Law Center compilation (current through 2024-52). Two routes. The Food Sovereignty Act covers "direct producer-to-consumer transactions" - on the producer premises, at roadside stands, fundraisers, farmers markets - in a municipality that has adopted an ordinance, and is not the route an internet marketplace sale takes. The route that does apply is Home Food Manufacturing: "Application for approval for Home Food Manufacturing shall be filed annually with the Department of Agriculture, Food And Rural Resources", with a fee and an inspection before a licence issues or renews. This row records that route: licence required, no cap.'
where state_code = 'ME' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 25000,
  requires_license = false,
  notes = 'Verified against the Michigan Food Law cottage food provisions, read 2026-09-05 in the National Agricultural Law Center compilation. No licence: "(1) A cottage food operation is exempt from the licensing and evaluation provisions of this act", though not from adulteration standards or enforcement. Cap: gross sales "shall not exceed $25,000.00 annually" (raised from $20,000 after 31 December 2017), computed per domestic residence rather than per person. Critically for this marketplace, the statute confines sales "to the consumer only, and not by internet or mail order", and prohibits consignment and wholesale - which is the primary source for Michigan being an online-sales ban rather than a summary.'
where state_code = 'MI' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 78000,
  requires_license = true,
  notes = 'Verified against Minn. Stat. 28A.152, read 2026-09-05 in the National Agricultural Law Center compilation. Cap: "An individual selling exempt foods under this section is limited to total sales with gross receipts of $78,000 or less in a calendar year." Registration IS required: "An individual who prepares and sells exempt food under subdivision 1 must register annually with the commissioner", annual fee $50, waived for an individual with $5,000 or less in annual gross receipts (CPI-adjusted) who instead completes a free online course and exam. Online selling is expressly allowed but shipping is not: products "may be sold over the Internet but must be delivered directly to the ultimate consumer by the individual who prepared the food product", and the homemade/not-inspected statement must appear on the website. NOTE: our seeded license_threshold of $7,665 for Minnesota does not appear in this text - the figures here are the $78,000 cap and the $5,000 fee exemption.'
where state_code = 'MN' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Mo. Rev. Stat. 196.298 (all six subsections), read 2026-09-05 in the National Agricultural Law Center compilation. No cap: the section sets none. No licence: "2. A cottage food production operation is not a food service establishment and shall not be subject to any health or food code laws or regulations of the state or department other than this section", and a local health department "shall not regulate the production of food at a cottage food production operation". Online selling is permitted but only within the state: "5. A cottage food production operation shall not sell any foods described in this section through the internet unless both the cottage food production operation and the purchaser are located in this state." Limited to baked goods, canned jam or jelly, and dried herbs or herb mixes.'
where state_code = 'MO' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 35000,
  requires_license = false,
  notes = 'Verified against the Mississippi cottage food provisions, read 2026-09-05 in the National Agricultural Law Center compilation. Cap $35,000: an operation "is exempt from the permitting requirements of Section 41-3-18 if the cottage food operation complies with this section and has annual gross sales of cottage food products that do not exceed Thirty-five Thousand Dollars ($35,000.00)", counted across all locations and product types - so the cap and the permit exemption are the same sentence. Confirms the online ban from primary text: "A cottage food operation may not sell cottage food products over the Internet, by mail order, or at wholesale or to a retail establishment; however, this does not prohibit the advertising of cottage food products over the Internet, including through social media."'
where state_code = 'MS' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Mont. Code 50-50-102, 50-50-116, 50-50-117 and 50-49 Part 2, read 2026-09-05 in the National Agricultural Law Center compilation. No cap under either route. Montana runs TWO routes and they differ on the point that matters here. (1) Cottage food operation, 50-50: registration with the local health authority and a fee are required, and it is face-to-face only - 50-50-102(6) defines "Direct sale" as "a face-to-face purchase or exchange" and adds "The direct sale may not be by consignment or involve shipping or internet sales." (2) Montana Local Food Choice Act, 50-49-201 et seq.: "Homemade" is food prepared in a private home that is not licensed or permitted, and 50-49-202(1) defines "Deliver" as a transfer by the producer or a designated agent "at a farm, ranch, home, office, traditional community social event, other private property, or another location agreed to between the producer or agent and the informed end consumer" - no licence, and internet sales are neither authorised nor prohibited. This fallback row records the Local Food Choice Act route: no cap, no licence. Montana is therefore NOT a blanket online-sales ban; the ban attaches to the cottage food operation route only, so which route a seller is on decides it.'
where state_code = 'MT' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against N.D. Cent. Code ch. 23-09.5, read 2026-09-05 in the National Agricultural Law Center compilation. No cap. No licence, and put unusually strongly: 23-09.5-02(1) "Notwithstanding any other provision of law, a state agency or political subdivision may not require licensure, permitting, certification, inspection, packaging, or labeling that pertains to the preparation or sale of cottage food products under this section", though an agency may still assist or inspect on request. The operator must inform the end consumer that the product "is not certified, labeled, licensed, packaged, regulated, or inspected", and must label refrigerated products. The chapter does not mention internet sales either way, so online status is left unclear rather than read in.'
where state_code = 'ND' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against Neb. Rev. Stat. 81-2,245.01 and 81-2,280, read 2026-09-05 in the National Agricultural Law Center compilation. No cap. Registration IS required: "The producer shall register with the department prior to conducting any sales of food", on prescribed forms recording the food safety training taken. The producer must hold a food handler permit or have completed a department-approved food safety and handling course. Supports the pre-checkout disclosure rule already in the app: the required notice must appear at the private home, "on the producer website, if such website exists, and in any print, radio, television, or Internet advertisement for such sales."'
where state_code = 'NE' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against N.H. Rev. Stat. 143-A:12 and 143-A:13 and N.H. Admin. Code He-P 2310.01, read 2026-09-05 in the National Agricultural Law Center compilation, with RSA 143-A:5 VII read directly at gc.nh.gov. LICENCE REQUIRED FOR THIS MARKETPLACE, and the reason is specific: 143-A:12 II exempts homestead food operations selling from the residence, their own farm stand, farmers markets or retail food stores, but III provides that operations exceeding the maximum "or homestead food operations who wish to sell food products ... over the Internet, by mail order, or to wholesalers, brokers, or other food distributors who will resell the homestead product shall be licensed under RSA 143-A:4." Selling online is itself the trigger, whatever the turnover. Cap not recorded: 143-A:12 refers to a maximum "as defined in RSA 143-A:5, VII", but that paragraph carries no figure, and He-P 2310.01 defines the exempt category by venue and product type rather than by revenue - so no dollar figure is recorded here rather than guessed.'
where state_code = 'NH' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 50000,
  requires_license = true,
  notes = 'Verified against N.J. Admin. Code 8:24-11, read 2026-09-05 in the National Agricultural Law Center compilation. Cap: "The gross annual sales (that is, before deductions of taxes and operating expenses) that a cottage food operator generates from the sale of cottage food products shall not exceed $50,000." Permit required by definition: a "Cottage food operator" is "a person who holds a New Jersey Cottage Food Operator Permit". Online selling is expressly contemplated - orders, payment and marketing may be by "United States postal mail, common carrier, electronic communication, internet, and/or telephone" - provided the delivery or relinquishment of the products occurs in New Jersey.'
where state_code = 'NJ' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against N.M. Stat. 25-12-1 to 25-12-5 (Homemade Food Act) and N.M. Code R. 7.6.2.15, read 2026-09-05 in the National Agricultural Law Center compilation. No cap. No licence: 25-12-3(A) provides that homemade food items are regulated under the Homemade Food Act and "are exempt from other requirements pursuant to the Food Service Sanitation Act ... and the New Mexico Food Act", conditional on the items not being time-and-temperature-control foods and on the seller completing a department-approved food handler certification course. Online selling is named in the statute itself: the seller must sell "directly to consumers within the state, including at farmers markets, at festivals, on the internet, at roadside stands, at the seller home for pick-up or delivery or through mail delivery." The seller must disclose that the food is produced at a private residence exempt from state licensing and inspection and may contain allergens.'
where state_code = 'NM' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 35000,
  requires_license = true,
  notes = 'Verified against Nev. Rev. Stat. 446.866 and 587.6945, read 2026-09-05 in the National Agricultural Law Center compilation. Cap $35,000: the definitions confine both the cottage food operation and the craft food operation to one "whose gross sales of such food items are not more than $35,000 per calendar year". Registration with the health authority is required, which may charge a fee not exceeding its actual cost of maintaining the registry, and may inspect only to investigate a suspect food item. Confirms the online ban from primary text: sales must be "by means of an in-person transaction that does not involve selling the food item by telephone or via the Internet."'
where state_code = 'NV' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against 1 N.Y. Comp. Codes R. & Regs. Part 276, read 2026-09-05 in the National Agricultural Law Center compilation (current through Register Vol. 46 No. 52). No cap in the Part. No licence: qualifying home processing establishments "shall be exempt from the licensing requirements of Article 20-C of the Agriculture and Markets Law, provided that such establishments are maintained in a sanitary condition and manner" and the listed sanitation requirements are met. "Home processed food" is confined to food made in a private home using only the ordinary kitchen facilities also used for the household, and expressly excludes potentially hazardous foods, thermally processed low-acid foods in hermetically sealed containers, and acidified foods in closed containers. The exemption is conditional, so treat it as exemption-on-conditions rather than a blanket absence of regulation.'
where state_code = 'NY' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Ohio Rev. Code 3715.023 and 3715.025 and Ohio Admin. Code 901:3-20, read 2026-09-05 in the National Agricultural Law Center compilation (current through regulations filed 16 Dec 2024). No cap and no licence for a cottage food production operation: chapter 901:3-20 governs them through product restrictions, labelling and sampling rather than licensure. 3715.025(A) bars a cottage food production operation from processing acidified foods, low acid canned foods or potentially hazardous foods, and the director may not make rules permitting potentially hazardous foods. Note Ohio also runs a separate home bakery route which does involve licensing; this fallback row records the cottage food route.'
where state_code = 'OH' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 75000,
  requires_license = false,
  notes = 'Verified against the Oklahoma Homemade Food Freedom Act, read 2026-09-05 in the National Agricultural Law Center compilation. Cap $75,000: a qualifying business is one "on the premises of a residence in which homemade food products are created for sale or resale if the business has gross annual sales of prepared food of less than Seventy-five Thousand Dollars ($75,000.00)", counted across all locations. No licence: qualifying production and sale "shall be exempt from all licensing and other requirements of the State Department of Health and the Oklahoma Department of Agriculture, Food, and Forestry". Online selling is expressly permitted: products may be sold "by the producer directly to the consumer, either in person or by remote means, including, but not limited to, the Internet or telephone", or through a designated agent or third-party vendor that displays the required placard. No seafood, meat or meat by-products.'
where state_code = 'OK' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 50000,
  requires_license = false,
  notes = 'Verified against the Oregon domestic kitchen / home food establishment provisions of ORS ch. 616, read 2026-09-05 in the National Agricultural Law Center compilation. Cap $50,000: the exemption holds while "The annual gross sales of foods prepared at the food establishment do not exceed $50,000, adjusted annually for inflation pursuant to the Consumer Price Index for All Urban Consumers, West Region (All Items) ... and rounded to the nearest $100", and the department must make that adjustment annually - so treat $50,000 as the base rather than the current figure. No licence in the ordinary case: the department may require licensure only "if the food establishment refuses to comply with department rules requiring that the food establishment be constructed and maintained in a clean, healthful and sanitary condition." Online and mail selling are expressly permitted - sales may be made "directly to the end user in any manner, including from the home, online, through the mail and at events."'
where state_code = 'OR' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = true,
  notes = 'Verified against R.I. Gen. Laws 21-27-6.1 (farm home food manufacture), read 2026-09-05 in the National Agricultural Law Center compilation. No cap. Registration IS required: "A certificate of registration shall be issued by the department upon the payment of a fee as set forth in 23-1-54 and the submission of an affidavit of compliance", valid one year and revocable for noncompliance. Two further constraints matter here: the kitchen must be "on the premises of a farm", and the permitted outlets are "farmers markets, farmstands, and other markets and stores operated by farmers for the purpose of the retail sale of the products of Rhode Island farms" - a venue list that does not include internet sales, which is the basis for treating Rhode Island as an online-sales ban.'
where state_code = 'RI' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against S.C. Code 44-1-143, read 2026-09-05 in the National Agricultural Law Center compilation (current through the 2024 Session). No cap and no licence or registration: the section imposes handling and labelling duties on the operator but contains no licensing provision at all. Online selling is in the definition itself - a "Home-based food production operation" prepares and distributes nonpotentially hazardous foods "for sale directly to a person, including online and by mail order, or to retail stores, including grocery stores." Two specific exclusions were added and are easy to miss: the definition "does not include preparing, processing, packaging, storing, or distributing aluminum canned goods or charcuterie boards."'
where state_code = 'SC' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against S.D. Codified Laws 34-18-35 to 34-18-38, read 2026-09-05 in the National Agricultural Law Center compilation. No cap. No licence: 34-18-35 provides that "the licensure provisions of this chapter do not apply to a person selling" non-temperature-controlled food prepared at a residence, home-processed canned goods, baked goods prepared at a residence, or food authorized under 34-18-36 or 34-18-36.1. Canned goods must have a pH of 4.6 or less or water activity of .85 or less, and that producer must complete department-approved food safety training every five years (or hold third-party recipe verification). Note that the separate 34-18-36.1 exemption is conditioned on the food being "sold in the seller physical presence" at the residence, a farmers market or a roadside stand - that condition attaches to that provision, not to the general 34-18-35 exemption.'
where state_code = 'SD' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 150000,
  requires_license = false,
  notes = 'Verified against Tex. Health & Safety Code ch. 437 at statutes.capitol.texas.gov, read 2026-09-05. Cap: Sec. 437.001(2-b)(B) — annual gross income of $150,000 or less from cottage food sales. The statute directs DSHS to adjust that figure annually for inflation by CPI-U, so treat $150,000 as the statutory base and re-check the department current figure before relying on it. No licence or permit: Sec. 437.0191(a) provides a cottage food production operation is not a food service establishment, and (c) exempts wholesale-for-resale from ch. 431 licensing. Sec. 437.0195(a) does require the operator to complete an accredited food-handler training programme — that is training, not a licence. Sales must be direct to the consumer or to a cottage food vendor (Sec. 437.001(2-b)(C)).'
where state_code = 'TX' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against Utah Code 4-5a-101 to 4-5a-105 (Home Consumption and Homemade Food Act) and 4-5-501, read 2026-09-05 in the National Agricultural Law Center compilation. No cap and no licence on this route: the Act works through a "direct-to-sale location" - "a farm, ranch, direct-to-sale farmers market, home, office, or any location agreed upon by both a producer and the informed final consumer" - and the consumer must have "been informed that the product is not certified, licensed, regulated, or inspected by the state". The Act does not mention internet sales either way. Utah also runs separate cottage food and microenterprise home kitchen routes that do involve permits; this fallback row records the Homemade Food Act route.'
where state_code = 'UT' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 9000,
  requires_license = false,
  notes = 'Verified against Va. Code 3.2-5130 (home food processing exemptions), read 2026-09-05 in the National Agricultural Law Center compilation. Cap $9,000, and it applies to BOTH home-kitchen subdivisions: subdivision 3 (candies, jams, jellies, dried fruits, baked goods and the rest) and subdivision 4 (pickles and other acidified vegetables at pH 4.6 or lower) each end with "not exceeding $9,000 in gross sales in a calendar year". No licence - these are exemptions from the permit requirement in 3.2-5100. IMPORTANT CORRECTION to our seeded data: both subdivisions expressly permit sale "at any location, through the internet, or by phone to an individual in the Commonwealth", and delivery "in person, by mail, or by delivery service", and each adds that nothing in it prohibits "advertising such food products on the Internet". Our seed had Virginia as an online and mail BAN with a $3,000 acidified-only cap; the statute says the opposite on channel and a different figure on the cap. Separately, honey from the resident own hives is its own subdivision, capped at 250 gallons annually.'
where state_code = 'VA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 30000,
  requires_license = false,
  notes = 'Verified against 18 V.S.A. 4301, 4303, 4353 and 4358, read 2026-09-05 in the National Agricultural Law Center compilation. Threshold $30,000: the fee schedule provides that for food manufacturing establishments that are cottage food operations, "Gross receipts of $30,000.00 or less from the sale of cottage food products are exempt pursuant to section 4358 of this title." Below that figure no licence is required; above it the establishment is licensed. A separate bracket exempts non-bakery food manufacturing establishments with gross receipts of $10,000 or less, and a home bakery licence is $100 annually. NOTE: our seeded license_threshold figures for Vermont ($6,500 / $10,000) do not both appear here - the cottage food figure in this text is $30,000.'
where state_code = 'VT' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 35000,
  requires_license = true,
  notes = 'Verified against Wash. Rev. Code 69.22.020, 69.22.030, 69.22.040 and 69.22.050, read 2026-09-05 in the National Agricultural Law Center compilation. Cap $35,000: "the annual gross sales of cottage food products may not exceed $35,000", computed per domestic residence rather than per person, and the department reviews the figure every four years. A permit IS required - 69.22.030 governs permits and renewals and 69.22.040 inspections. CRITICAL CORRECTION to our seeded data: 69.22.020(4) provides "Cottage food products may only be sold directly to the consumer and may not be sold by internet, mail order, or for retail sale outside the state." Our seed had Washington as online ALLOWED, which would have let a Washington seller list food here in breach of the statute. Products must also be stored only in the primary domestic residence.'
where state_code = 'WA' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = null,
  requires_license = false,
  notes = 'Verified against W. Va. Code ch. 19 art. 40, read 2026-09-05 in the National Agricultural Law Center compilation (current through 12 June 2026). No cap. No permit in the ordinary case: 19-40-2(a) requires a permit only of "a person wanting to sell potentially hazardous cottage food", and (d) expressly exempts from that permit "(1) A person selling fresh, uncut produce; (2) A person selling nonpotentially hazardous fo[ods]". A permittee selling potentially hazardous cottage food "is not required to obtain a food establishment permit to sell from home". Cottage food "shall be sold only within the geographic boundaries of the State of West Virginia". Excludes meat, poultry, seafood and Grade A dairy.'
where state_code = 'WV' and verified_at is null;

update public.state_cottage_food_rules set
  revenue_cap = 250000,
  requires_license = false,
  notes = 'Verified against Wyo. Stat. ch. 11 art. 49 (Wyoming Food Freedom Act), read 2026-09-05 in the National Agricultural Law Center compilation (current through the 2024 Budget Session). Cap $250,000, and it is a two-part test: a "Producer" is one who "does not produce more than two hundred fifty thousand (250,000) individual food or drink products annually and does not exceed two hundred fifty thousand dollars ($250,000.00) in gross revenue annually" - a unit count as well as a revenue figure, so a high-volume low-price seller can fail the first while passing the second. No licence: "Homemade means food that is prepared or processed in a private home kitchen, that is not licensed, inspected or regulated", and the informed end consumer must be told the product "is not licensed, regulated or inspected". Delivery may be made by the producer or a designated agent "at a farm, ranch, farmers market, home, office or any location agreed to between the producer and the informed end consumer"; the Act does not address internet sales either way.'
where state_code = 'WY' and verified_at is null;

-- ---------------------------------------------------------------------------
-- 2. Program rows — the four reviewed field by field against the statute.
--
-- These are the rows the product gates actually read: `state_allows_online_food_sales()` and
-- `seller_permits_food_axis()` resolve through a seller's chosen programme before falling back to
-- the state row, so a wrong `online_orders` here is what would have permitted an unlawful listing.
-- ---------------------------------------------------------------------------

-- CO · Cottage Foods Act
update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  mail_note = null,
  direct_delivery = 'unclear',
  venue_note = 'No restrictions',
  retail_allowed = false,
  revenue_cap = 150000,
  cap_basis = 'annual_total',
  cap_note = 'Colo. Rev. Stat. 25-4-1614: "gross revenues of one hundred fifty thousand dollars or less per calendar year", adjusted annually by the department for CPI (Denver-Aurora-Lakewood). This replaces a per-product $10,000 figure that is no longer in the statute.',
  cap_category = null,
  license_threshold = null,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'banned',
  cat_meat = 'conditional',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'banned',
  category_note = 'Under 1,000 personally-raised poultry',
  license_required = 'yes',
  license_note = 'The label must carry "the producers name, department-issued registration number", and the department publishes a page for consumers to verify a producers active registration - so registration is required.',
  inspection_required = false,
  recipe_approval = 'no',
  recipe_note = null,
  training_required = 'yes',
  training_note = null,
  training_url = null,
  application_url = null,
  local_preemption = false,
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Colorado.pdf'
where state_code = 'CO' and ordinal = 1 and verified_at is null;

-- TX · Cottage Food
update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'banned',
  mail_note = 'Not through the mail or third-party carriers',
  direct_delivery = 'allowed',
  venue_note = 'An internet sale is permitted only if the operator, their employee or a household member personally delivers the food to the consumer (§437.0194(b)(1)). No mail, no third-party carriers.',
  retail_allowed = true,
  revenue_cap = 150000,
  cap_basis = 'annual_total',
  cap_note = 'Adjusted annually for inflation by the department using CPI-U (§437.001(2-b)(B)), so this figure is point-in-time.',
  cap_category = null,
  license_threshold = null,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'allowed',
  cat_meat = 'banned',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'allowed',
  category_note = null,
  license_required = 'no',
  license_note = null,
  inspection_required = false,
  recipe_approval = 'conditional',
  recipe_note = 'Acidified, fermented and pickled canned foods',
  training_required = 'yes',
  training_note = null,
  training_url = null,
  application_url = null,
  local_preemption = true,
  source_url = 'https://statutes.capitol.texas.gov/Docs/HS/htm/HS.437.htm'
where state_code = 'TX' and ordinal = 1 and verified_at is null;

-- VA · Home Kitchen Exemptions
update public.state_food_programs set
  online_orders = 'allowed',
  mail_delivery = 'allowed',
  mail_note = null,
  direct_delivery = 'allowed',
  venue_note = 'Both subdivisions permit sale "at any location, through the internet, or by phone to an individual in the Commonwealth" and delivery "in person, by mail, or by delivery service", and each adds that nothing in it prohibits advertising on the Internet. Corrected 2026-09-05 - the seed had online and mail as banned.',
  retail_allowed = false,
  revenue_cap = 9000,
  cap_basis = 'annual_total',
  cap_note = 'Va. Code 3.2-5130 subdivisions 3 and 4 each end "not exceeding $9,000 in gross sales in a calendar year". Corrected 2026-09-05 from a $3,000 acidified-only per_category figure that is not in the statute.',
  cap_category = null,
  license_threshold = null,
  cat_shelf_stable = 'unrestricted',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'allowed',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'banned',
  category_note = null,
  license_required = 'no',
  license_note = null,
  inspection_required = false,
  recipe_approval = 'no',
  recipe_note = null,
  training_required = 'no',
  training_note = null,
  training_url = null,
  application_url = null,
  local_preemption = false,
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Virginia.pdf'
where state_code = 'VA' and ordinal = 1 and verified_at is null;

-- WA · Cottage Food
update public.state_food_programs set
  online_orders = 'banned',
  mail_delivery = 'banned',
  mail_note = 'RCW 69.22.020(4) bars internet and mail order outright.',
  direct_delivery = 'unclear',
  venue_note = 'RCW 69.22.020(4): "Cottage food products may only be sold directly to the consumer and may not be sold by internet, mail order, or for retail sale outside the state." Corrected 2026-09-05 - the seed had this as online allowed.',
  retail_allowed = false,
  revenue_cap = 35000,
  cap_basis = 'annual_total',
  cap_note = 'RCW 69.22.050: annual gross sales may not exceed $35,000, computed per domestic residence, reviewed by the department every four years.',
  cap_category = null,
  license_threshold = null,
  cat_shelf_stable = 'list_only',
  cat_refrigerated = 'banned',
  cat_meat = 'banned',
  cat_acidified = 'banned',
  cat_low_acid_canned = 'banned',
  cat_fermented = 'banned',
  category_note = 'Department of Agriculture approved list',
  license_required = 'yes',
  license_note = null,
  inspection_required = true,
  recipe_approval = 'yes',
  recipe_note = null,
  training_required = 'yes',
  training_note = null,
  training_url = null,
  application_url = null,
  local_preemption = false,
  source_url = 'https://nationalaglawcenter.org/wp-content/uploads/assets/cottagefood/Washington.pdf'
where state_code = 'WA' and ordinal = 1 and verified_at is null;

-- ---------------------------------------------------------------------------
-- 3. What is still unsourced.
--
-- DC, NC, PA, TN and WI are untouched and still carry the seeded placeholder. Each was left alone
-- for a reason rather than for lack of trying: the National Agricultural Law Center compilation has
-- no entry for DC, NC or TN (North Carolina appears to have no cottage food statute at all, only a
-- home-processing inspection route), its Pennsylvania entry reproduces only 7 Pa. Code 46.212 which
-- governs supplying retail food facilities rather than direct-to-consumer sales, and its Wisconsin
-- entry reproduces Wis. Stat. 97.30 on retail food establishment licensing rather than the
-- home-baking exemption. Each needs a different primary source.
-- ---------------------------------------------------------------------------

comment on table public.state_cottage_food_rules is
  'Per-state cottage-food cap and licence position. Figures and citations are seeded from each '
  'state''s own statute or administrative code (20260905140000); verified_at additionally records '
  'that a person re-checked the row in THIS environment, and is never seeded.';

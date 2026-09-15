import { afterAll, beforeAll, expect, it } from "vitest";

import {
  adminDb,
  anonDb,
  cleanupAll,
  createSeller,
  createTestUser,
  describeDb,
  type TestUser,
} from "./helpers";

/**
 * The rule this whole feature turns on: an unanswered question is NOT public.
 *
 * Both competitors publish a question the instant it is asked, which makes a storefront something
 * a stranger can write on while the seller is away for a week. Here, answering is what publishes —
 * so the public Q&A is made only of exchanges the seller chose to stand behind, and the asker and
 * the seller can still see it in the meantime.
 */
describeDb("seller_questions", () => {
  let asker: TestUser;
  let stranger: TestUser;
  let sellerUser: TestUser;
  let seller: { id: string };
  let questionId: string;

  beforeAll(async () => {
    asker = await createTestUser({ homeState: "TX", displayName: "Marta Ilic" });
    stranger = await createTestUser({ homeState: "TX" });
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("lets a signed-in buyer ask, and snapshots their name", async () => {
    const { data, error } = await asker.db
      .from("seller_questions")
      .insert({ seller_id: seller.id, asker_id: asker.id, body: "Is the sourdough dairy free?" })
      .select("id, asker_name, status")
      .single();

    expect(error).toBeNull();
    expect(data!.asker_name).toBe("Marta Ilic");
    expect(data!.status).toBe("open");
    questionId = data!.id;
  });

  it("refuses an anonymous question — an answered one is published under a name", async () => {
    const { error } = await anonDb()
      .from("seller_questions")
      .insert({ seller_id: seller.id, asker_id: asker.id, body: "Anonymous" });
    expect(error).not.toBeNull();
  });

  it("refuses a question filed under someone else's name", async () => {
    const { error } = await stranger.db
      .from("seller_questions")
      .insert({ seller_id: seller.id, asker_id: asker.id, body: "Not mine" });
    expect(error).not.toBeNull();
  });

  it("refuses a question that arrives pre-answered", async () => {
    const { error } = await asker.db.from("seller_questions").insert({
      seller_id: seller.id,
      asker_id: asker.id,
      body: "Self-answered",
      answer: "Yes",
      status: "answered",
    });
    expect(error).not.toBeNull();
  });

  it("hides an unanswered question from everyone but the asker and the seller", async () => {
    const asAnon = await anonDb()
      .from("seller_questions")
      .select("id")
      .eq("id", questionId)
      .maybeSingle();
    expect(asAnon.data).toBeNull();

    const asStranger = await stranger.db
      .from("seller_questions")
      .select("id")
      .eq("id", questionId)
      .maybeSingle();
    expect(asStranger.data).toBeNull();

    const asAsker = await asker.db
      .from("seller_questions")
      .select("id")
      .eq("id", questionId)
      .maybeSingle();
    expect(asAsker.data?.id).toBe(questionId);

    const asSeller = await sellerUser.db
      .from("seller_questions")
      .select("id")
      .eq("id", questionId)
      .maybeSingle();
    expect(asSeller.data?.id).toBe(questionId);
  });

  it("will not let the seller rewrite the question they were asked", async () => {
    const { error } = await sellerUser.db
      .from("seller_questions")
      .update({ body: "A nicer question" })
      .eq("id", questionId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/only a question's answer may be edited/i);
  });

  it("refuses an answer without the matching status, and vice versa", async () => {
    const answerOnly = await sellerUser.db
      .from("seller_questions")
      .update({ answer: "Yes it is" })
      .eq("id", questionId);
    expect(answerOnly.error?.message).toMatch(/seller_questions_answer_status/i);

    const statusOnly = await sellerUser.db
      .from("seller_questions")
      .update({ status: "answered" })
      .eq("id", questionId);
    expect(statusOnly.error?.message).toMatch(/seller_questions_answer_status/i);
  });

  it("publishes the question once the seller answers it", async () => {
    const { error } = await sellerUser.db
      .from("seller_questions")
      .update({
        answer: "Yes — flour, water, salt and starter.",
        status: "answered",
        answered_at: new Date().toISOString(),
      })
      .eq("id", questionId);
    expect(error).toBeNull();

    const { data } = await anonDb()
      .from("seller_questions")
      .select("body, answer, asker_name")
      .eq("id", questionId)
      .maybeSingle();
    expect(data?.answer).toBe("Yes — flour, water, salt and starter.");
    expect(data?.asker_name).toBe("Marta Ilic");
  });

  it("lets the asker withdraw their own question, and nobody else", async () => {
    const { data: q } = await asker.db
      .from("seller_questions")
      .insert({ seller_id: seller.id, asker_id: asker.id, body: "Withdraw me" })
      .select("id")
      .single();

    const bySeller = await sellerUser.db.from("seller_questions").delete().eq("id", q!.id);
    expect(bySeller.error).toBeNull();
    // RLS filters rather than errors, so prove the row survived.
    const { data: still } = await adminDb()
      .from("seller_questions")
      .select("id")
      .eq("id", q!.id)
      .maybeSingle();
    expect(still?.id).toBe(q!.id);

    await asker.db.from("seller_questions").delete().eq("id", q!.id);
    const { data: gone } = await adminDb()
      .from("seller_questions")
      .select("id")
      .eq("id", q!.id)
      .maybeSingle();
    expect(gone).toBeNull();
  });
});

describeDb("seller_posts", () => {
  let sellerUser: TestUser;
  let otherUser: TestUser;
  let seller: { id: string };

  beforeAll(async () => {
    sellerUser = await createTestUser({ role: "seller", homeState: "TX" });
    otherUser = await createTestUser({ role: "seller", homeState: "TX" });
    seller = await createSeller(sellerUser.id, { homeState: "TX" });
    await createSeller(otherUser.id, { homeState: "TX" });
  });

  afterAll(cleanupAll);

  it("lets a seller post, and anyone read it", async () => {
    const { error } = await sellerUser.db
      .from("seller_posts")
      .insert({ seller_id: seller.id, body: "No bread this Saturday — back on the 14th." });
    expect(error).toBeNull();

    const { data } = await anonDb().from("seller_posts").select("body").eq("seller_id", seller.id);
    expect((data ?? []).length).toBe(1);
  });

  it("will not let one seller post on another's storefront", async () => {
    const { error } = await otherUser.db
      .from("seller_posts")
      .insert({ seller_id: seller.id, body: "Not mine to write" });
    expect(error).not.toBeNull();
  });

  it("stays readable while the seller is on a break — that post is the point", async () => {
    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: true, pause_reason: "vacation", on_vacation: true })
      .eq("id", seller.id);

    const { data } = await anonDb().from("seller_posts").select("body").eq("seller_id", seller.id);
    expect((data ?? []).length).toBe(1);

    await adminDb()
      .from("seller_profiles")
      .update({ is_paused: false, pause_reason: null, on_vacation: false })
      .eq("id", seller.id);
  });
});

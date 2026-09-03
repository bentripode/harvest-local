import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { revenueCapCheck } from "@/lib/inngest/functions/revenue-cap";
import { licenseExpiryScan } from "@/lib/inngest/functions/license-expiry";
import { referralActivate } from "@/lib/inngest/functions/referral-activate";
import { referralInvalidate } from "@/lib/inngest/functions/referral-invalidate";

/**
 * The endpoint Inngest calls to run our functions. `serve` verifies the request signature
 * against INNGEST_SIGNING_KEY (skipped in dev). Registered with the Dev Server automatically
 * in local dev; in production you sync `https://<domain>/api/inngest` from the Inngest dashboard.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [revenueCapCheck, licenseExpiryScan, referralActivate, referralInvalidate],
});

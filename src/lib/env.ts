import { z } from "zod";

/**
 * Environment is validated once, here. Read config through `env` everywhere else so a missing or
 * malformed variable fails loudly at startup instead of surfacing as a runtime bug.
 *
 * Server secrets never carry the NEXT_PUBLIC_ prefix and are only referenced from server code.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_CONNECT_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  STRIPE_SUBSCRIPTION_PRICE_ID: z.string().startsWith("price_"),
  STRIPE_SELLER_TRIAL_DAYS: z.coerce.number().int().positive().default(90),

  // Inngest (background jobs). Neither is needed for local dev with `npm run inngest:dev`.
  INNGEST_EVENT_KEY: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  INNGEST_SIGNING_KEY: z
    .string()
    .startsWith("signkey-")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),

  // Email (Resend). Optional — with no key, notification-dispatch logs instead of sending.
  RESEND_API_KEY: z
    .string()
    .startsWith("re_")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z.string().optional().or(z.literal("")).transform((v) => v || undefined),

  // Error tracking (Sentry). Optional — with no DSN the SDK is inert and the app is unchanged.
  // SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN are build-time only (source-map upload) and
  // read directly in next.config.ts, not here.
  SENTRY_DSN: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  NEXT_PUBLIC_SENTRY_DSN: z
    .string()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),

  // App
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Mapbox. NEXT_PUBLIC_ token is for the browser map (GL JS). MAPBOX_TOKEN is an optional
  // server-side token (Geocoding + Directions, for delivery quoting) — falls back to the public
  // one. With neither set, delivery is unavailable and pickup is unaffected.
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  MAPBOX_TOKEN: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
});

const clientSchema = serverSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true,
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_MAPBOX_TOKEN: true,
  NEXT_PUBLIC_SENTRY_DSN: true,
});

const isServer = typeof window === "undefined";

/**
 * On the server `process.env` holds every variable. In the browser bundle it does NOT —
 * only `process.env.NEXT_PUBLIC_*` expressions the bundler can see as literal member
 * accesses get inlined at build time; `process.env` as a whole object is empty there.
 * So on the client we hand the schema an explicit object, one static reference per var.
 */
function clientEnvSource() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

function loadEnv() {
  const parsed = isServer
    ? serverSchema.safeParse(process.env)
    : clientSchema.safeParse(clientEnvSource());

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env.local and fill it in.`,
    );
  }
  return parsed.data;
}

export const env = loadEnv() as z.infer<typeof serverSchema>;

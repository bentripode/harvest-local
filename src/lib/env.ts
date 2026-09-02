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

  // App
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Mapbox (Phase 1 map / geocoding — optional until the map lands)
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
});

const clientSchema = serverSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true,
  NEXT_PUBLIC_SITE_URL: true,
  NEXT_PUBLIC_MAPBOX_TOKEN: true,
});

const isServer = typeof window === "undefined";

function loadEnv() {
  const schema = isServer ? serverSchema : clientSchema;
  const parsed = schema.safeParse(process.env);

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

import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "@/components/auth-form";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const params = await searchParams;
  const role = params.role === "buyer" ? "buyer" : "seller";
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role === "seller" ? "Start selling" : "Create your account"}</CardTitle>
        <CardDescription>
          {role === "seller"
            ? "Set up a storefront. You'll add payout details and start a 90-day free trial next."
            : "Join Harvest Local."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignUpForm role={role} next={next} />
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

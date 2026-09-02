import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "@/components/auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const checkEmail = params.checkEmail === "1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to Harvest Local.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checkEmail ? (
          <p className="bg-muted/50 rounded-md border p-3 text-sm">
            Check your email to confirm your account, then sign in.
          </p>
        ) : null}
        <SignInForm next={next} />
        <p className="text-muted-foreground text-center text-sm">
          New here?{" "}
          <Link href="/signup?role=seller" className="underline underline-offset-4">
            Create a seller account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

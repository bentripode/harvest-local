import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessMode } from "@/lib/auth";
import { getTaxIdKeyStatus } from "@/lib/admin/encryption";
import { setAccessModeAction } from "../actions";

export const metadata = { title: "Settings — Admin" };

export default async function AdminSettingsPage() {
  const [mode, keys] = await Promise.all([getAccessMode(), getTaxIdKeyStatus()]);
  const isPublic = mode === "public";
  const next = isPublic ? "sellers_only" : "public";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Platform-wide switches.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Marketplace access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={isPublic ? "default" : "secondary"}>
              {isPublic ? "Public" : "Sellers only"}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {isPublic
                ? "The marketplace is open — buyers see the early-access notice removed and can sign up to shop."
                : "Early access — sellers are getting storefronts ready; the home page shows a buyer-shopping-soon notice."}
            </span>
          </div>
          <form action={setAccessModeAction}>
            <input type="hidden" name="mode" value={next} />
            <Button type="submit" size="sm" variant={isPublic ? "outline" : "default"}>
              {isPublic ? "Switch back to sellers-only" : "Open to the public"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tax ID encryption</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!keys.configured ? (
            <p className="text-destructive">
              No encryption key is configured, so the compliance form is refusing tax IDs and no
              seller can finish onboarding. Set{" "}
              <code className="text-xs">TAX_ID_ENCRYPTION_KEYS</code>.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">active key {keys.activeKeyId}</Badge>
                <span className="text-muted-foreground">
                  {keys.total} tax ID{keys.total === 1 ? "" : "s"} stored
                </span>
              </div>

              {keys.usage.length > 0 ? (
                <ul className="text-muted-foreground space-y-1">
                  {keys.usage.map((u) => (
                    <li key={String(u.keyId)}>
                      key {u.keyId ?? "unknown"}: {u.count} row{u.count === 1 ? "" : "s"}
                      {u.active ? " (active)" : " — awaiting re-encryption"}
                    </li>
                  ))}
                </ul>
              ) : null}

              {keys.stale > 0 ? (
                <p className="text-muted-foreground">
                  <strong>{keys.stale}</strong> row{keys.stale === 1 ? "" : "s"} still on an older
                  key. <code className="text-xs">tax-id-rekey</code> runs nightly — keep every key
                  listed above in <code className="text-xs">TAX_ID_ENCRYPTION_KEYS</code> until this
                  reaches zero, or those rows become unreadable.
                </p>
              ) : (
                <p className="text-green-700">
                  Everything is on the active key — any older key can be dropped from the
                  environment.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessMode } from "@/lib/auth";
import { setAccessModeAction } from "../actions";

export const metadata = { title: "Settings — Admin" };

export default async function AdminSettingsPage() {
  const mode = await getAccessMode();
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
    </div>
  );
}

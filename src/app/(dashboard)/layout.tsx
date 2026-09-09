import { SellerShell } from "@/components/seller-shell";
import { TabBarSpacer } from "@/components/tab-bar";
import { PauseBanner } from "@/components/pause-banner";
import { getSellerContext } from "@/lib/auth";
import { getUnreadNotificationCount } from "@/lib/compliance";
import { getUnreadMessageCount } from "@/lib/messages/queries";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, seller } = await getSellerContext();
  const [unread, unreadMessages] = await Promise.all([
    seller ? getUnreadNotificationCount(profile.id) : Promise.resolve(0),
    getUnreadMessageCount(profile.id),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <SellerShell
        unread={unread}
        unreadMessages={unreadMessages}
        isAdmin={profile.role === "admin"}
      />
      <PauseBanner seller={seller} />
      {/* Tighter gutters and a shorter top gap on a phone; desktop framing is unchanged. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <TabBarSpacer />
    </div>
  );
}

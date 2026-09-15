import { CartProvider } from "@/components/cart-provider";
import { ShopShell } from "@/components/shop-shell";
import { TabBarSpacer } from "@/components/tab-bar";
import { getProfile, getUser } from "@/lib/auth";
import { getUnreadMessageCount } from "@/lib/messages/queries";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  const isSeller = profile?.role === "seller" || profile?.role === "admin";
  const unreadMessages = user ? await getUnreadMessageCount(user.id) : 0;

  return (
    <CartProvider>
      <div className="flex min-h-full flex-col">
        <ShopShell user={user} isSeller={isSeller} unreadMessages={unreadMessages} />
        {/* Tighter gutters and a shorter top gap on a phone; desktop framing is unchanged. */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <TabBarSpacer />
      </div>
    </CartProvider>
  );
}

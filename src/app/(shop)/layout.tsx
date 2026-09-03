import { CartProvider } from "@/components/cart-provider";
import { ShopHeader } from "@/components/shop-header";
import { getProfile, getUser } from "@/lib/auth";
import { getUnreadMessageCount } from "@/lib/messages/queries";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  const isSeller = profile?.role === "seller" || profile?.role === "admin";
  const unreadMessages = user ? await getUnreadMessageCount(user.id) : 0;

  return (
    <CartProvider>
      <div className="flex min-h-full flex-col">
        <ShopHeader user={user} isSeller={isSeller} unreadMessages={unreadMessages} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </CartProvider>
  );
}

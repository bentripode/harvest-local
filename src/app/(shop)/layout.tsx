import { CartProvider } from "@/components/cart-provider";
import { ShopHeader } from "@/components/shop-header";
import { getUser } from "@/lib/auth";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  return (
    <CartProvider>
      <div className="flex min-h-full flex-col">
        <ShopHeader user={user} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </CartProvider>
  );
}

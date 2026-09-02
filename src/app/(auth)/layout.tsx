import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        Harvest Local
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

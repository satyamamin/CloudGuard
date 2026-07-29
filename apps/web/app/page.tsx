import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">CloudGuard 360</h1>
      <p className="mt-2 text-sm text-slate-600">Azure cost management, deployed inside your own tenant.</p>
      <Link href="/connect-azure" className="mt-6 inline-block text-sm font-medium text-slate-900 underline">
        Connect Azure &rarr;
      </Link>
    </main>
  );
}

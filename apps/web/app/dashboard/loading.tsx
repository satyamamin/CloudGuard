export default function Loading() {
  return (
    <div>
      <div className="h-6 w-32 animate-pulse rounded bg-black/5" />
      <div className="mt-2 h-4 w-48 animate-pulse rounded bg-black/5" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg bg-black/5" />
        <div className="h-24 animate-pulse rounded-lg bg-black/5" />
        <div className="h-24 animate-pulse rounded-lg bg-black/5" />
      </div>
      <div className="mt-8 h-72 animate-pulse rounded-md bg-black/5" />
    </div>
  );
}

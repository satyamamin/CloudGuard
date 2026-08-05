export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-md border border-dashed border-[var(--border)] py-16 text-sm text-[var(--text-muted)]">
      {message}
    </div>
  );
}

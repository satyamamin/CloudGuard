export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border py-16 text-center text-sm"
      style={{ borderColor: "var(--status-critical)", color: "var(--status-critical)" }}
    >
      {message}
    </div>
  );
}

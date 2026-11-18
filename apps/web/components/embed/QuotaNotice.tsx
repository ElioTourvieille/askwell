/** Message convivial « limite atteinte / quota atteint » (déclenché par la route de chat en phase 3). */
export function QuotaNotice() {
  return (
    <p role="alert" className="rounded-glass border border-glass-border bg-surface px-3.5 py-3 text-sm">
      L&apos;assistant a atteint sa limite de messages pour le moment. Merci de réessayer un peu plus tard.
    </p>
  );
}

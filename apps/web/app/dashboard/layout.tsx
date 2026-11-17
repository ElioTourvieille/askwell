import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { APP_NAME } from "@askwell/shared";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { ensureAccount } from "../../lib/accounts/ensure-account";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // L'identifiant vient de la session Clerk côté serveur, jamais de la requête.
  const { userId } = await auth();
  if (!userId) throw new Error("Session Clerk absente sur le tableau de bord.");
  // Si l'insertion échoue, l'erreur remonte à `error.tsx` (sans détail affiché).
  await ensureAccount(userId);

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-fg">
      <DashboardShell appName={APP_NAME} userMenu={<UserButton />}>
        {children}
      </DashboardShell>
    </div>
  );
}

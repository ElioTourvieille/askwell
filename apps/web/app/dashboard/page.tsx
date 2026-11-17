import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";

export default async function DashboardPage() {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  return (
    <main className="p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <UserButton />
      </header>
    </main>
  );
}

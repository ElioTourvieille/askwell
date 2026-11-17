import { auth } from "@clerk/nextjs/server";
import { EmptyState } from "../../components/states";
import { Button } from "../../components/ui";

export default async function DashboardPage() {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Projets</h1>
      <EmptyState
        title="Aucun projet pour l'instant"
        text="La création de projet arrive bientôt."
        action={<Button disabled>Bientôt</Button>}
      />
    </div>
  );
}

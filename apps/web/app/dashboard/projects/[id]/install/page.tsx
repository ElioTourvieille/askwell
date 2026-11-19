import { auth } from "@clerk/nextjs/server";
import { InstallPanel } from "../../../../../components/install";
import { ErrorState } from "../../../../../components/states";
import { loadInstallPage } from "../../../../../lib/install/loadInstallPage";

export default async function InstallPage({ params }: { params: Promise<{ id: string }> }) {
  // Défense en profondeur : le proxy protège déjà /dashboard.
  await auth.protect();

  const { id } = await params;
  const { snippet } = await loadInstallPage(id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold break-words">Installer le widget</h1>
      {snippet ? (
        <InstallPanel snippet={snippet} />
      ) : (
        <ErrorState
          title="Adresse de l'application non configurée"
          text="La variable NEXT_PUBLIC_APP_URL est absente ou invalide : l'extrait ne peut pas être généré. Contactez l'administrateur."
        />
      )}
    </div>
  );
}

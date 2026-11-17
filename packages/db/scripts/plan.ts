/** `<horodatage UTC AAAAMMJJHHMMSS>_<nom>.sql` */
export const MIGRATION_FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/**
 * Choisit, dans l'ordre des horodatages, les migrations pas encore appliquées.
 * Fonction pure. Refuse les situations ambiguës au lieu de les deviner :
 * - deux migrations avec la même version ;
 * - une version appliquée qui n'existe plus sur le disque ;
 * - une migration en attente plus ancienne que la dernière appliquée (ordre rompu).
 */
export function pickPendingMigrations<T extends { version: string }>(
  available: readonly T[],
  appliedVersions: readonly string[],
): T[] {
  const sorted = [...available].sort((a, b) => a.version.localeCompare(b.version));

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]?.version === sorted[i - 1]?.version) {
      throw new Error(`Deux migrations portent la version ${sorted[i]?.version}.`);
    }
  }

  const availableVersions = new Set(sorted.map((m) => m.version));
  for (const version of appliedVersions) {
    if (!availableVersions.has(version)) {
      throw new Error(`La version ${version} est enregistrée dans la base mais son fichier est introuvable.`);
    }
  }

  const applied = new Set(appliedVersions);
  const pending = sorted.filter((m) => !applied.has(m.version));
  const lastApplied = [...appliedVersions].sort().at(-1);

  if (lastApplied) {
    const outOfOrder = pending.find((m) => m.version < lastApplied);
    if (outOfOrder) {
      throw new Error(
        `La migration ${outOfOrder.version} est plus ancienne que la dernière appliquée (${lastApplied}) : ordre rompu.`,
      );
    }
  }

  return pending;
}

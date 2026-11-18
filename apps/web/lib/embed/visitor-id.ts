const STORAGE_KEY = "askwell_visitor_id";

let memoryId: string | null = null;

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Identifiant aléatoire du visiteur, conservé dans le `localStorage` de l'iframe.
 * Tout accès au stockage est protégé : s'il est bloqué (mode privé, cookies tiers refusés…),
 * on utilise un identifiant en mémoire pour la durée de la page.
 */
export function getVisitorId(getStorage: () => Storage = () => window.localStorage): string {
  try {
    const storage = getStorage();
    const existing = storage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = memoryId ?? newId();
    storage.setItem(STORAGE_KEY, id);
    memoryId = id;
    return id;
  } catch {
    memoryId ??= newId();
    return memoryId;
  }
}

/** Pour les tests uniquement : remet l'identifiant mémoire à zéro. */
export function resetMemoryVisitorId(): void {
  memoryId = null;
}

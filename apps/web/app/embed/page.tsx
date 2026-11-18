import { WidgetConfigRequestSchema } from "@askwell/shared";
import { EmbedPanel } from "../../components/embed/EmbedPanel";
import { getEmbedConfig } from "../../lib/embed/config";
import { parseParentOrigin } from "../../lib/embed/parent";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Écran neutre : clé invalide ou inconnue, rien d'autre n'est affiché. */
function Neutral() {
  return <main aria-hidden="true" className="min-h-dvh" />;
}

export default async function EmbedPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsed = WidgetConfigRequestSchema.safeParse({ key: first(params.key) });
  if (!parsed.success) return <Neutral />;

  const config = await getEmbedConfig(parsed.data.key);
  if (!config) return <Neutral />;

  // Origine de la page hôte : sans origine valide, le panneau ne parle pas au chargeur.
  const parentOrigin = parseParentOrigin(first(params.origin));
  return <EmbedPanel config={config} parentOrigin={parentOrigin} />;
}

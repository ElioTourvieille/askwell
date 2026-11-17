export type NavItem = { href: string; label: string };

/** Une seule entrée pour l'instant : les phases suivantes ajouteront les leurs (aucun lien mort). */
export const NAV_ITEMS: NavItem[] = [{ href: "/dashboard", label: "Projets" }];

/** Entrée active : le chemin exact ou une sous-page (jamais un préfixe partiel comme /dashboardx). */
export function isActiveItem(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

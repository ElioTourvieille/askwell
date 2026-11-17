import { PLAN_LIMITS } from "@askwell/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSupabasePglite, type DbSession, type SupabasePglite } from "./supabase-pglite";

let sb: SupabasePglite;

beforeEach(async () => {
  sb = await createSupabasePglite();
});

afterEach(async () => {
  await sb.close();
});

async function addAccount(userId: string, plan: "free" | "pro" = "free") {
  await sb.asService((tx) => tx.query("insert into public.accounts (clerk_user_id, plan) values ($1, $2)", [userId, plan]));
}

function createProject(tx: DbSession, userId: string, name: string, plan: "free" | "pro") {
  return tx.query<{ id: string; public_key: string }>(
    "select * from public.create_project($1, $2, $3)",
    [userId, name, PLAN_LIMITS[plan].maxProjects],
  );
}

async function seedTwoOwners() {
  await addAccount("user_a");
  await addAccount("user_b");
  await sb.asService(async (tx) => {
    await createProject(tx, "user_a", "Projet A", "free");
    await createProject(tx, "user_b", "Projet B", "free");
  });
}

describe("isolation par propriétaire", () => {
  it("un propriétaire ne voit que ses projets et leur config", async () => {
    await seedTwoOwners();

    const projects = await sb.asUser("user_a", (tx) => tx.query<{ name: string }>("select name from public.projects"));
    expect(projects.rows).toEqual([{ name: "Projet A" }]);

    const configs = await sb.asUser("user_a", (tx) => tx.query("select * from public.widget_configs"));
    expect(configs.rows).toHaveLength(1);
  });

  it("un propriétaire ne peut pas lire accounts", async () => {
    await seedTwoOwners();
    await expect(sb.asUser("user_a", (tx) => tx.query("select * from public.accounts"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("un propriétaire ne peut ni renommer ni supprimer le projet d'un autre", async () => {
    await seedTwoOwners();

    const renamed = await sb.asUser("user_a", (tx) =>
      tx.query("update public.projects set name = 'Piraté' where owner_id = 'user_b'"),
    );
    expect(renamed.affectedRows).toBe(0);

    const deleted = await sb.asUser("user_a", (tx) => tx.query("delete from public.projects where owner_id = 'user_b'"));
    expect(deleted.affectedRows).toBe(0);

    const stillThere = await sb.db.query("select 1 from public.projects where owner_id = 'user_b'");
    expect(stillThere.rows).toHaveLength(1);
  });
});

describe("anon", () => {
  it("n'a accès à aucune table", async () => {
    await seedTwoOwners();
    for (const table of ["accounts", "projects", "widget_configs"]) {
      await expect(sb.asAnon((tx) => tx.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/);
    }
    await expect(
      sb.asAnon((tx) => tx.query("insert into public.accounts (clerk_user_id) values ('x')")),
    ).rejects.toThrow(/permission denied/);
  });

  it("n'exécute aucune fonction", async () => {
    await expect(sb.asAnon((tx) => tx.query("select * from public.owned_project_ids()"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(sb.asAnon((tx) => createProject(tx, "user_a", "X", "free"))).rejects.toThrow(/permission denied/);
  });
});

describe("écritures du propriétaire", () => {
  it("peut renommer son projet (name uniquement)", async () => {
    await seedTwoOwners();
    await sb.asUser("user_a", (tx) => tx.query("update public.projects set name = 'Renommé'"));
    const row = await sb.db.query<{ name: string }>("select name from public.projects where owner_id = 'user_a'");
    expect(row.rows[0]?.name).toBe("Renommé");
  });

  it("ne peut modifier aucune autre colonne", async () => {
    await seedTwoOwners();
    for (const set of ["public_key = 'pk_x'", "messages_used = 0", "owner_id = 'user_b'", "period_start = now()"]) {
      await expect(sb.asUser("user_a", (tx) => tx.query(`update public.projects set ${set}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("ne peut rien insérer ni modifier ailleurs", async () => {
    await seedTwoOwners();
    await expect(
      sb.asUser("user_a", (tx) =>
        tx.query("insert into public.projects (owner_id, name, public_key) values ('user_a', 'N', 'pk_n')"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      sb.asUser("user_a", (tx) => tx.query("insert into public.accounts (clerk_user_id) values ('user_c')")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      sb.asUser("user_a", (tx) => tx.query("update public.widget_configs set show_badge = false")),
    ).rejects.toThrow(/permission denied/);
  });

  it("peut supprimer son projet, ce qui supprime sa config", async () => {
    await seedTwoOwners();
    await sb.asUser("user_a", (tx) => tx.query("delete from public.projects"));
    const configs = await sb.db.query("select 1 from public.widget_configs");
    expect(configs.rows).toHaveLength(1); // reste celle de user_b
  });
});

describe("TRUNCATE", () => {
  it("est refusé à tous les rôles de l'API", async () => {
    await seedTwoOwners();
    await expect(sb.asAnon((tx) => tx.query("truncate public.projects cascade"))).rejects.toThrow(/permission denied/);
    await expect(sb.asService((tx) => tx.query("truncate public.projects cascade"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(sb.asUser("user_a", (tx) => tx.query("truncate public.projects"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("create_project", () => {
  it("Free : accepte le 1er projet (avec config par défaut), refuse le 2e", async () => {
    await addAccount("user_a", "free");

    const first = await sb.asService((tx) => createProject(tx, "user_a", "Premier", "free"));
    expect(first.rows[0]?.public_key).toMatch(/^pk_[0-9a-f]{32}$/);

    const config = await sb.db.query<{ button_color: string; position: string; show_badge: boolean }>(
      "select * from public.widget_configs where project_id = $1",
      [first.rows[0]?.id],
    );
    expect(config.rows[0]).toMatchObject({ button_color: "#000000", position: "bottom-right", show_badge: true });

    await expect(sb.asService((tx) => createProject(tx, "user_a", "Second", "free"))).rejects.toThrow(
      /plan_limit_reached/,
    );
    const count = await sb.db.query("select 1 from public.projects");
    expect(count.rows).toHaveLength(1);
  });

  it("Pro : accepte jusqu'à 5 projets, refuse le 6e", async () => {
    await addAccount("user_p", "pro");
    for (let i = 1; i <= PLAN_LIMITS.pro.maxProjects; i++) {
      await sb.asService((tx) => createProject(tx, "user_p", `Projet ${i}`, "pro"));
    }
    await expect(sb.asService((tx) => createProject(tx, "user_p", "Projet 6", "pro"))).rejects.toThrow(
      /plan_limit_reached/,
    );
  });

  it("la limite est propre à chaque propriétaire", async () => {
    await seedTwoOwners();
    const rows = await sb.db.query<{ owner_id: string }>("select owner_id from public.projects order by owner_id");
    expect(rows.rows.map((r) => r.owner_id)).toEqual(["user_a", "user_b"]);
  });

  it("refuse un compte inconnu", async () => {
    await expect(sb.asService((tx) => createProject(tx, "inconnu", "X", "free"))).rejects.toThrow(/account_not_found/);
  });

  it("est inexécutable par authenticated", async () => {
    await addAccount("user_a");
    await expect(sb.asUser("user_a", (tx) => createProject(tx, "user_a", "X", "free"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("règles de sécurité de la base (§9)", () => {
  it("chaque table de public a la RLS activée", async () => {
    const tables = await sb.db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(tables.rows.map((t) => t.relname).sort()).toEqual(["accounts", "projects", "widget_configs"]);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
  });

  it("chaque fonction de public a search_path vide ; seul owned_project_ids est SECURITY DEFINER", async () => {
    const fns = await sb.db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
      `select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    expect(fns.rows.map((f) => f.proname).sort()).toEqual(["create_project", "owned_project_ids"]);
    for (const fn of fns.rows) {
      expect(fn.proconfig).toContain('search_path=""');
    }
    expect(fns.rows.filter((f) => f.prosecdef).map((f) => f.proname)).toEqual(["owned_project_ids"]);
  });

  it("EXECUTE est limité : create_project à service_role seul, owned_project_ids sans anon", async () => {
    const can = async (role: string, fn: string) =>
      (await sb.db.query<{ ok: boolean }>("select has_function_privilege($1, $2, 'execute') as ok", [role, fn])).rows[0]
        ?.ok;

    const create = "public.create_project(text, text, integer)";
    expect(await can("service_role", create)).toBe(true);
    expect(await can("authenticated", create)).toBe(false);
    expect(await can("anon", create)).toBe(false);

    const owned = "public.owned_project_ids()";
    expect(await can("authenticated", owned)).toBe(true);
    expect(await can("service_role", owned)).toBe(true);
    expect(await can("anon", owned)).toBe(false);
  });
});

import { ProjectSchema } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { toProject } from "./to-project";

const ROW = {
  id: "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c71",
  owner_id: "user_a",
  name: "Mon site",
  public_key: "pk_abc",
  messages_used: 4,
  period_start: "2026-11-01T00:00:00+00:00",
  created_at: "2026-11-17T14:24:50.123456+00:00",
};

describe("toProject", () => {
  it("produit un Project valide pour le contrat, sans owner_id", () => {
    const project = toProject(ROW);
    expect(ProjectSchema.parse(project)).toEqual(project);
    expect(project).not.toHaveProperty("owner_id");
    expect(project.publicKey).toBe("pk_abc");
    expect(project.messagesUsed).toBe(4);
  });

  it("normalise les dates en UTC (Z), que la base renvoie une chaîne ou un Date", () => {
    expect(toProject(ROW).periodStart).toBe("2026-11-01T00:00:00.000Z");
    const asDate = toProject({ ...ROW, created_at: new Date("2026-11-17T14:24:50Z") as unknown as string });
    expect(asDate.createdAt).toBe("2026-11-17T14:24:50.000Z");
  });
});

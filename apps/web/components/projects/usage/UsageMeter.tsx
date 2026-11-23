import type { Plan } from "@askwell/shared";
import { computeUsage } from "../../../lib/usage/compute-usage";
import { formatCreatedAt } from "../../../lib/projects-ui/format";
import { Badge } from "../../ui";
import { cx } from "../../ui/cx";

type Props = { messagesUsed: number; periodStart: string; plan: Plan; now?: Date };

/** « X / Y messages ce mois-ci », barre de progression, badge d'avertissement à la limite. */
export function UsageMeter({ messagesUsed, periodStart, plan, now }: Props) {
  const usage = computeUsage({ messagesUsed, periodStart, plan, now });
  const label = `${usage.used} / ${usage.limit} messages ce mois-ci`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {usage.reached ? <Badge className="border-danger text-danger">Limite atteinte</Badge> : null}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        className="h-2 w-full overflow-hidden rounded-full bg-surface"
      >
        <div
          className={cx("h-full rounded-full", usage.reached ? "bg-danger" : "bg-primary")}
          style={{ width: `${usage.percent}%` }}
        />
      </div>
      <p className="text-xs text-muted">Remise à zéro le {formatCreatedAt(usage.nextResetAt)}</p>
    </div>
  );
}

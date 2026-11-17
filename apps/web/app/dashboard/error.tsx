"use client";

import { ErrorState } from "../../components/states";
import { Button } from "../../components/ui";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState action={<Button onClick={reset}>Réessayer</Button>} />;
}

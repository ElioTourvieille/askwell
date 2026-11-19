/**
 * Message neutre quand la protection refuse un message (400 `injection_blocked`). Il ne dit rien de la
 * détection, n'a pas de bouton « Réessayer » (renvoyer le même texte donnerait le même refus) et la saisie
 * reste active pour que le visiteur reformule.
 */
export function RejectedNotice() {
  return (
    <p role="alert" className="rounded-glass border border-glass-border bg-surface px-3.5 py-3 text-sm">
      Ce message ne peut pas être traité. Reformulez votre question.
    </p>
  );
}

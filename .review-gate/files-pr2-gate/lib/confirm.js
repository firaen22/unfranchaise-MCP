/** Dry-run gate for mutating tools. */

export class DryRunError extends Error {
  constructor(message, preview) {
    super(message);
    this.name = 'DryRunError';
    this.preview = preview;
  }
}

export function requireConfirm(args, actionDescription) {
  if (args?.confirm === true) return;
  throw new DryRunError(
    `Dry-run: ${actionDescription}. Set confirm: true to execute (still your responsibility).`,
    { action: actionDescription, wouldMutate: true },
  );
}

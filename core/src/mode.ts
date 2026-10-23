/** Explicit opt-in; existing full deployments keep their original integrations. */
export function isLeanMode(): boolean {
  return process.env["BUTTON_MODE"] === "lean";
}

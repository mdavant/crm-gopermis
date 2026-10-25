/** Dates are instants with explicit offset. Sessions use whole minutes. */
export function sessionMinutes(start: string, end: string): number {
  const duration = (Date.parse(end) - Date.parse(start)) / 60000;
  if (!Number.isSafeInteger(duration) || duration <= 0)
    throw new Error(
      "L’heure de fin doit suivre le début, avec une durée en minutes entières.",
    );
  return duration;
}
export function parisDate(instant: string) {
  return new Date(instant).toLocaleDateString("en-CA", {
    timeZone: "Europe/Paris",
  });
}

export type Rate = {
  id: string;
  model: string;
  support: string;
  cents: number;
  validFrom: string;
  validTo: string | null;
};
export type Offer = {
  id: string;
  paidMinutes: number;
  bonusMinutes: number;
  singlePayment: boolean;
};
export function quote(
  rates: Rate[],
  offers: Offer[],
  input: {
    model: string;
    support: string;
    minutes: number;
    offerId?: string;
    date: string;
  },
) {
  if (
    !Number.isSafeInteger(input.minutes) ||
    input.minutes <= 0 ||
    input.minutes > 60000
  )
    throw new Error("Durée invalide");
  const applicable = rates
    .filter(
      (r) =>
        r.model === input.model &&
        r.support === input.support &&
        r.validFrom <= input.date &&
        (!r.validTo || input.date < r.validTo),
    )
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const rate = applicable[0];
  if (!rate) throw new Error("Aucun tarif disponible pour cette combinaison");
  const offer = input.offerId
    ? offers.find((o) => o.id === input.offerId)
    : undefined;
  if (input.offerId && !offer) throw new Error("Offre inconnue");
  if (offer && offer.paidMinutes !== input.minutes)
    throw new Error("Durée incompatible avec le forfait");
  return {
    rateId: rate.id,
    offerId: offer?.id ?? null,
    unitCents: rate.cents,
    paidMinutes: input.minutes,
    potentialBonusMinutes: offer?.bonusMinutes ?? 0,
    singlePayment: offer?.singlePayment ?? false,
    totalCents: Math.round((rate.cents * input.minutes) / 60),
    model: input.model,
    support: input.support,
    acceptedOn: input.date,
  };
}
export function eligibleCompanion(licenseDate: string, on: string): boolean {
  const d = new Date(licenseDate + "T00:00:00Z"),
    now = new Date(on + "T00:00:00Z");
  if (
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== licenseDate ||
    !Number.isFinite(now.getTime()) ||
    now.toISOString().slice(0, 10) !== on ||
    !/^\d{4}-\d{2}-\d{2}$/.test(licenseDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(on)
  )
    return false;
  const years = now.getUTCFullYear() - d.getUTCFullYear();
  return years > 5 || (years === 5 && on.slice(5) >= licenseDate.slice(5));
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@]/g, "");
}

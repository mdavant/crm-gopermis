import type { ClientRecord } from "../lib/api-types";

/** Date (ISO ou objet date MySQL) → valeur d'un champ <input type="date">. */
export function toDateInput(v?: string | null) {
  // Les dates sans heure arrivent en « AAAA-MM-JJ » ou « AAAA-MM-JJT00:00:00.000Z » (UTC).
  return v ? String(v).slice(0, 10) : "";
}
export function ClientFields({ client }: { client?: ClientRecord }) {
  return (
    <>
      <div className="formGrid">
        <label>
          Prénom
          <input
            name="firstName"
            required
            maxLength={100}
            defaultValue={client?.first_name ?? ""}
            autoComplete="given-name"
            autoFocus
          />
        </label>
        <label>
          Nom
          <input
            name="lastName"
            required
            maxLength={100}
            defaultValue={client?.last_name ?? ""}
            autoComplete="family-name"
          />
        </label>
      </div>
      <label>
        Téléphone
        <input
          name="phone"
          type="tel"
          required
          minLength={6}
          maxLength={30}
          defaultValue={client?.phone ?? ""}
          autoComplete="tel"
        />
      </label>
      <label>
        Email (facultatif)
        <input
          name="email"
          type="email"
          defaultValue={client?.email ?? ""}
          autoComplete="email"
        />
      </label>
      <label>
        Adresse
        <input
          name="address"
          maxLength={255}
          defaultValue={client?.address ?? ""}
          autoComplete="street-address"
          placeholder="ex : 2 rue Colette 31200 Toulouse"
        />
      </label>
      <div className="formGrid">
        <label>
          Date de naissance
          <input name="birthDate" type="date" defaultValue={toDateInput(client?.birth_date)} max={new Date().toISOString().slice(0, 10)} />
        </label>
        <label>
          NEPH (facultatif)
          <input name="neph" maxLength={20} pattern="[0-9A-Za-z ]{6,20}" defaultValue={client?.neph ?? ""} placeholder="N° de dossier permis" />
        </label>
      </div>
      <label>
        Origine
        <input
          name="source"
          required
          defaultValue={client?.source ?? "Saisie manuelle"}
          maxLength={100}
        />
      </label>
    </>
  );
}

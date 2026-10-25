import type { ClientRecord } from "../lib/api-types";
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

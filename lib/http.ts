/** Do not expose HTML/error bodies (which can contain server details) to users. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(type))
    throw new Error(
      `L’API ne répond pas en JSON (HTTP ${response.status}). Rechargez l’aperçu avec le serveur Next.js actif ; une page HTML a été reçue à la place de l’API.`,
    );
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Réponse JSON illisible de l’API (HTTP ${response.status}). Réessayez après le redémarrage de l’aperçu.`,
    );
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Erreur du serveur";
    throw new Error(message);
  }
  return data as T;
}

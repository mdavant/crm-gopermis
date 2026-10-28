/** Safely read and parse API response, handling both JSON and unexpected HTML error pages gracefully. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new Error(
        `Erreur du serveur (HTTP ${response.status}). Vérifiez la configuration.`,
      );
    }
    throw new Error("Réponse inattendue du serveur.");
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Erreur du serveur (HTTP ${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

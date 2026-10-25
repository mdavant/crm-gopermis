export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
/** Do not expose HTML/error bodies (which can contain server details) to users. */
export async function readApiResponse<T>(response: Response): Promise<T> {
  const type = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(type))
    throw new ApiError(
      `L’API ne répond pas en JSON (HTTP ${response.status}). Rechargez l’aperçu avec le serveur Next.js actif ; une page HTML a été reçue à la place de l’API.`,
      response.status,
      "API_UNAVAILABLE",
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
    throw new ApiError(
      message,
      response.status,
      data &&
        typeof data === "object" &&
        "code" in data &&
        typeof data.code === "string"
        ? data.code
        : "REQUEST_FAILED",
    );
  }
  return data as T;
}

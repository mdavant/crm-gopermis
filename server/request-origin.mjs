/** Compare against a configured origin, never a client-supplied proxy header. */
export function productionOriginAllowed(request, configuredOrigin) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const expected = new URL(configuredOrigin || new URL(request.url).origin);
    if (
      !["https:", "http:"].includes(expected.protocol) ||
      expected.username ||
      expected.password ||
      expected.pathname !== "/" ||
      expected.search ||
      expected.hash
    )
      return false;
    // URL canonicalizes host casing, the default port, surrounding whitespace
    // and the trailing root slash copied from an address bar.
    return origin === expected.origin;
  } catch {
    // A malformed explicit configuration must not fall back to request headers.
    return false;
  }
}

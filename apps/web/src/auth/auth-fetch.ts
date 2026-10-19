// fetch qui présente le jeton de l'utilisateur à l'API (Authorization: Bearer).
// Un 401 signifie que l'API ne reconnaît plus la session : onUnauthorized ramène à la connexion.
export function createAuthFetch(
  getToken: () => Promise<string | null>,
  onUnauthorized: () => void,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetchImpl(input, { ...init, headers });
    if (response.status === 401) onUnauthorized();
    return response;
  };
}

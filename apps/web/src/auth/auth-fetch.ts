export interface AuthFetchHandlers {
  // 401 : l'API ne reconnaît plus la session
  onUnauthorized: () => void;
  // 403 DEMO_SESSIONS_DISABLED : l'API n'accepte plus les sessions de démo
  onDemoRefused?: () => void;
}

const isDemoRefusal = async (response: Response) => {
  if (response.status !== 403) return false;
  // Copie : l'appelant lit encore le corps
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return (
    typeof body === "object" &&
    body !== null &&
    "errors" in body &&
    Array.isArray(body.errors) &&
    body.errors.some((error: { code?: unknown }) => error?.code === "DEMO_SESSIONS_DISABLED")
  );
};

// fetch qui présente le jeton de l'utilisateur à l'API (Authorization: Bearer) et signale les
// refus qui concernent la session elle-même. La réponse est toujours rendue à l'appelant.
export function createAuthFetch(
  getToken: () => Promise<string | null>,
  { onUnauthorized, onDemoRefused }: AuthFetchHandlers,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetchImpl(input, { ...init, headers });
    if (response.status === 401) onUnauthorized();
    else if (onDemoRefused && (await isDemoRefusal(response))) onDemoRefused();
    return response;
  };
}

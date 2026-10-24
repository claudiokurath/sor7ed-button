export const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      data.error ?? "Could not complete this request. Please try again.",
      res.status,
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
export const outcomeText: Record<string, string> = {
  accepted:
    "WhatsApp accepted your message. This does not confirm it reached your phone.",
  pending: "Saved. Still sending. Check status before trying again.",
  failed: "Saved. WhatsApp could not accept this message.",
  skipped: "Saved in your account. No WhatsApp message was sent.",
  unknown:
    "Saved. Send status unclear. Check your thread before requesting another send.",
};

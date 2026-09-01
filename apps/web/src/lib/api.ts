const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  fieldErrors?: { field: string; messages: string[] }[];

  constructor(status: number, message: string, fieldErrors?: { field: string; messages: string[] }[]) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Maps the API's {field, messages}[] shape to {field: "joined message"} so a
// form can show each error next to the input it belongs to, instead of just
// a generic "Validation failed" banner.
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.fieldErrors) return {};
  return Object.fromEntries(err.fieldErrors.map((f) => [f.field, f.messages.join(", ")]));
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed", body.errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

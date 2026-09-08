export interface FetchJsonOptions {
  timeoutMs?: number;
  revalidateSeconds?: number;
  headers?: HeadersInit;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "CumberlandMoonbow/1.0",
      ...options.headers,
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    next: { revalidate: options.revalidateSeconds ?? 300 },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchText(url: string, options: FetchJsonOptions = {}): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "CumberlandMoonbow/1.0", ...options.headers },
    signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    next: { revalidate: options.revalidateSeconds ?? 300 },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.text();
}

export async function fetchBuffer(url: string, options: FetchJsonOptions = {}): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": "CumberlandMoonbow/1.0", ...options.headers },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    next: { revalidate: options.revalidateSeconds ?? 300 },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned ${response.status}`);
  return response.arrayBuffer();
}

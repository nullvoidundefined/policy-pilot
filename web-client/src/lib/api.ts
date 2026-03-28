const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed (${res.status})`,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body?.error?.message ?? `Upload failed (${res.status})`,
      );
    }
    return res.json();
  });
}

export function streamPost(
  path: string,
  body: unknown,
): ReadableStream<Uint8Array> | null {
  const controller = new AbortController();

  const responsePromise = fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  return new ReadableStream({
    async start(streamController) {
      try {
        const res = await responsePromise;
        if (!res.ok || !res.body) {
          streamController.close();
          return;
        }
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamController.enqueue(value);
        }
        streamController.close();
      } catch {
        streamController.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
}

export { API_BASE };

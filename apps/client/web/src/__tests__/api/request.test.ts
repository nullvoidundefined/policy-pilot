import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CSRF_PATH = '/api/csrf-token';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function importApi() {
  vi.resetModules();
  return import('@/lib/api');
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('get', () => {
  it('returns parsed JSON on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { get } = await importApi();

    const result = await get<{ ok: boolean }>('/widgets');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/widgets'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'nope' }, 404));
    vi.stubGlobal('fetch', fetchMock);
    const { get, ApiError } = await importApi();

    await expect(get('/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'nope',
    });
    await expect(get('/missing')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('post', () => {
  it('fetches a CSRF token then sends it on the state-changing request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(jsonResponse({ created: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await importApi();

    const result = await post<{ created: boolean }>('/widgets', { name: 'a' });

    expect(result).toEqual({ created: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(CSRF_PATH),
      expect.objectContaining({ credentials: 'include' }),
    );
    const secondCallInit = fetchMock.mock.calls[1][1];
    expect(secondCallInit.method).toBe('POST');
    expect(secondCallInit.headers['X-CSRF-Token']).toBe('csrf-1');
  });

  it('clears the cached token and retries once on a 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' })) // ensureCsrfToken
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'bad csrf' } }, 403),
      ) // attempt 0
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-2' })) // re-fetch token
      .mockResolvedValueOnce(jsonResponse({ ok: true })); // attempt 1 succeeds
    vi.stubGlobal('fetch', fetchMock);
    const { post } = await importApi();

    const result = await post<{ ok: boolean }>('/widgets', { name: 'a' });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('del', () => {
  it('returns undefined for a 204 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { del } = await importApi();

    const result = await del<void>('/widgets/1');

    expect(result).toBeUndefined();
  });
});

describe('uploadFile', () => {
  it('posts FormData with the CSRF token and no JSON content-type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'doc-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { uploadFile } = await importApi();
    const form = new FormData();
    form.append('file', new Blob(['x']), 'x.pdf');

    const result = await uploadFile<{ id: string }>('/documents', form);

    expect(result).toEqual({ id: 'doc-1' });
    const uploadInit = fetchMock.mock.calls[1][1];
    expect(uploadInit.headers['X-CSRF-Token']).toBe('csrf-1');
    expect(uploadInit.headers['Content-Type']).toBeUndefined();
  });
});

describe('streamPost', () => {
  it('returns a readable stream of the response body bytes', async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-1' }))
      .mockResolvedValueOnce(new Response(upstream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { streamPost } = await importApi();

    const stream = await streamPost('/qa/stream', { question: 'hi' });
    const reader = stream!.getReader();
    const { value } = await reader.read();

    expect(new TextDecoder().decode(value)).toBe('hello');
  });
});

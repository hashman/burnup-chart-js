import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setAuthHandlers, requestJson, requestJsonNoAuth } from '../api';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  setAuthHandlers({ getToken: () => null, onUnauthorized: () => Promise.resolve(null) });
});

function jsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

describe('requestJsonNoAuth', () => {
  it('sends GET request with Content-Type header', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ status: 'ok' }));

    const result = await requestJsonNoAuth('/api/health');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ detail: 'Not Found' }, 404));

    await expect(requestJsonNoAuth('/api/nope')).rejects.toThrow();
  });

  it('returns null for 204 No Content', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') }),
    );

    const result = await requestJsonNoAuth('/api/empty');
    expect(result).toBeNull();
  });
});

describe('requestJson', () => {
  it('sends request without auth header when no token', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ data: 1 }));

    await requestJson('/api/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('includes Bearer token when getToken returns a value', async () => {
    setAuthHandlers({ getToken: () => 'my-token', onUnauthorized: () => Promise.resolve(null) });
    mockFetch.mockReturnValueOnce(jsonResponse({ data: 1 }));

    await requestJson('/api/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer my-token');
  });

  it('retries with new token on 401', async () => {
    setAuthHandlers({
      getToken: () => 'old-token',
      onUnauthorized: () => Promise.resolve('new-token'),
    });

    // First call returns 401, second returns 200
    mockFetch
      .mockReturnValueOnce(
        Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') }),
      )
      .mockReturnValueOnce(jsonResponse({ refreshed: true }));

    const result = await requestJson('/api/protected');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, retryOpts] = mockFetch.mock.calls[1];
    expect(retryOpts.headers.Authorization).toBe('Bearer new-token');
    expect(result).toEqual({ refreshed: true });
  });

  it('does not retry when onUnauthorized returns null', async () => {
    setAuthHandlers({
      getToken: () => 'old-token',
      onUnauthorized: () => Promise.resolve(null),
    });

    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') }),
    );

    await expect(requestJson('/api/protected')).rejects.toThrow('Unauthorized');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on non-401 error', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('Server Error') }),
    );

    await expect(requestJson('/api/fail')).rejects.toThrow('Server Error');
  });

  it('returns null for 204 No Content', async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve('') }),
    );

    const result = await requestJson('/api/delete-thing');
    expect(result).toBeNull();
  });
});

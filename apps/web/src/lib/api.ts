import { z } from 'zod';
import {
  cardSchema,
  datasetSchema,
  accountSchema,
  graphSchema,
  sourceSchema,
  diagnosisSchema,
  draftSchema,
  qaResponseSchema,
  aiScanResponseSchema,
  sessionSchema,
  userSchema,
  type QaRequest,
  type LoginRequest,
} from '@kasirnusa/contracts';

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  body?: unknown,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch('/api' + path, {
    signal,
    headers,
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error((detail.error ?? 'Request failed') + ' (' + response.status + ')');
  }
  return schema.parse(await response.json());
}

const query = (dataset: string, options: Record<string, string> = {}) =>
  '?' + new URLSearchParams({ dataset_id: dataset, ...options });

export const api = {
  qa: (body: QaRequest, signal?: AbortSignal) => request('/qa', qaResponseSchema, signal, body),
  datasets: (signal?: AbortSignal) => request('/datasets', z.object({ items: z.array(datasetSchema) }), signal),
  accounts: (dataset: string, signal?: AbortSignal) =>
    request('/accounts' + query(dataset, { page_size: '100' }), z.object({ items: z.array(accountSchema) }), signal),
  opportunities: (dataset: string, options: Record<string, string>, signal?: AbortSignal) =>
    request('/opportunities' + query(dataset, options), z.object({ total: z.number(), items: z.array(cardSchema) }), signal),
  card: (dataset: string, id: string, signal?: AbortSignal) =>
    request('/opportunities/' + id + query(dataset), cardSchema, signal),
  diagnosis: (dataset: string, id: string, options: Record<string, string>, signal?: AbortSignal) =>
    request('/accounts/' + id + '/diagnosis' + query(dataset, options), diagnosisSchema, signal),
  graph: (dataset: string, kind: 'accounts' | 'opportunities', id: string, signal?: AbortSignal) =>
    request(
      '/' + kind + '/' + id + '/' + (kind === 'accounts' ? 'diagnosis/' : '') + 'evidence' + query(dataset),
      graphSchema,
      signal
    ),
  source: (dataset: string, id: string, signal?: AbortSignal) =>
    request('/sources/' + id + query(dataset), sourceSchema, signal),
  draft: (
    dataset: string,
    kind: 'accounts' | 'opportunities',
    id: string,
    language: 'en' | 'id',
    options: Record<string, string>,
    signal?: AbortSignal
  ) =>
    request('/' + kind + '/' + id + '/draft' + query(dataset, options), draftSchema, signal, { language }),
  deepScan: (dataset: string, body: { account_id?: string; max_scan?: number }, signal?: AbortSignal) =>
    request('/opportunities/scan' + query(dataset), aiScanResponseSchema, signal, body),
  login: (credentials: LoginRequest, signal?: AbortSignal) =>
    request('/auth/login', sessionSchema, signal, credentials),
  me: (token: string, signal?: AbortSignal) =>
    request('/auth/me', z.object({ user: userSchema }), signal, undefined, token),
  logout: (token: string, signal?: AbortSignal) =>
    request('/auth/logout', z.object({ success: z.boolean() }), signal, undefined, token),
  seedAuth: (signal?: AbortSignal) =>
    request('/auth/seed', z.object({ created: z.number(), existing: z.number() }), signal, {}),
};

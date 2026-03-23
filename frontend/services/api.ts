const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}/api${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${errText}`);
  }
  return response.json();
}

export const api = {
  // Jobs
  getJobs: () => request<any[]>('/jobs'),
  getJob: (id: string) => request<any>(`/jobs/${id}`),
  createJob: (data: any) =>
    request<any>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id: string, data: any) =>
    request<any>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteJob: (id: string) =>
    request<any>(`/jobs/${id}`, { method: 'DELETE' }),

  // Sessions
  createSession: (data: any) =>
    request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  updateSession: (id: string, data: any) =>
    request<any>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getSessions: (jobId?: string) =>
    request<any[]>(`/sessions${jobId ? `?job_id=${jobId}` : ''}`),

  // Config
  exportConfig: () => request<any>('/config/export'),
  importConfig: (data: any) =>
    request<any>('/config/import', { method: 'POST', body: JSON.stringify(data) }),

  // Seed
  seedData: () => request<any>('/seed', { method: 'POST' }),
};

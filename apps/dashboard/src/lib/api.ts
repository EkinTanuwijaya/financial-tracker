const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const response = await fetch(`${API_URL}/api${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    apiRequest<{ user: any; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiRequest<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => apiRequest<any>("/auth/me"),
};

export const transactionsApi = {
  list: (params?: Record<string, string>) => {
    const search = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiRequest<any[]>(`/transactions${search}`);
  },

  get: (id: string) => apiRequest<any>(`/transactions/${id}`),

  create: (data: any) =>
    apiRequest<any>("/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest<any>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/transactions/${id}`, {
      method: "DELETE",
    }),

  summary: (params?: Record<string, string>) => {
    const search = params ? `?${new URLSearchParams(params).toString()}` : "";
    return apiRequest<any>(`/transactions/summary${search}`);
  },
};

export const walletsApi = {
  list: () => apiRequest<any[]>("/wallets"),

  get: (id: string) => apiRequest<any>(`/wallets/${id}`),

  create: (data: any) =>
    apiRequest<any>("/wallets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: any) =>
    apiRequest<any>(`/wallets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/wallets/${id}`, {
      method: "DELETE",
    }),
};

export const categoriesApi = {
  list: () => apiRequest<any[]>("/categories"),

  get: (id: string) => apiRequest<any>(`/categories/${id}`),

  create: (data: any) =>
    apiRequest<any>("/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  seed: () =>
    apiRequest<any[]>("/categories/seed", {
      method: "POST",
    }),

  update: (id: string, data: any) =>
    apiRequest<any>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/categories/${id}`, {
      method: "DELETE",
    }),
};

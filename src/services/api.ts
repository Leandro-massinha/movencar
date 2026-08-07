import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

interface PublicApiError {
  error?: { message?: unknown };
}

export function getPublicErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação. Tente novamente.",
) {
  if (!axios.isAxiosError<PublicApiError>(error)) return fallback;
  const message = error.response?.data?.error?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 15000,
});
export const isSessionError = (error: unknown) =>
  error instanceof AxiosError &&
  [401, 419, 440].includes(error.response?.status ?? 0);
let accessToken: string | null = null;
let refreshRequest: Promise<string> | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthRoute =
      request?.url?.includes("/auth/login") ||
      request?.url?.includes("/auth/refresh");
    if (
      error.response?.status === 401 &&
      request &&
      !request._retried &&
      !isAuthRoute
    ) {
      request._retried = true;
      try {
        refreshRequest ??= api
          .post<{ accessToken: string }>("/auth/refresh")
          .then(({ data }) => {
            setAccessToken(data.accessToken);
            return data.accessToken;
          })
          .finally(() => {
            refreshRequest = null;
          });
        request.headers.Authorization = `Bearer ${await refreshRequest}`;
        return api(request);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent("movencar:session-revoked"));
      }
    } else if (isSessionError(error) && !isAuthRoute)
      window.dispatchEvent(new CustomEvent("movencar:session-revoked"));
    return Promise.reject(error);
  },
);

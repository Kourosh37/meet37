import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AuthLoginRequest,
  AuthLogoutRequest,
  AuthRefreshRequest,
  AuthResponse
} from "@/types/api";

export function login(request: AuthLoginRequest) {
  return apiRequest<AuthResponse, AuthLoginRequest>(endpoints.auth.login, {
    body: request,
    method: "POST"
  });
}

export function refresh(request: AuthRefreshRequest) {
  return apiRequest<AuthResponse, AuthRefreshRequest>(endpoints.auth.refresh, {
    body: request,
    method: "POST",
    retryOnUnauthorized: false
  });
}

export function logout(request: AuthLogoutRequest) {
  return apiRequest<void, AuthLogoutRequest>(endpoints.auth.logout, {
    body: request,
    method: "POST",
    retryOnUnauthorized: false
  });
}

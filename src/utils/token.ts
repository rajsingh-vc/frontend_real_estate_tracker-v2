export const ACCESS_TOKEN_KEY = "apex_access_token";
export const REFRESH_TOKEN_KEY = "apex_refresh_token";
export const USER_KEY = "apex_auth_user";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
import type { LoginResponse } from "@taskflow/types";
import { apiFetch } from "@/lib/api/client";
import type { LoginFormValues } from "./auth-schema";

export const authService = {
  login(payload: LoginFormValues) {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  me(token: string) {
    return apiFetch<LoginResponse["user"]>("/auth/me", { token });
  },
  logout(token: string, refreshToken: string) {
    return apiFetch<{ success: true }>("/auth/logout", {
      method: "POST",
      token,
      body: JSON.stringify({ refreshToken })
    });
  }
};

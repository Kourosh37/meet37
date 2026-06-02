import { useAuthStore } from "@/features/auth/stores/authStore";

export function useAuth() {
  return useAuthStore();
}

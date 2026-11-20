export type UserRole =
  | "ADMIN"
  | "OPERATOR"
  | "PENILAI"
  | "PENANGGUNG_JAWAB_PJU"
  | "PJU";

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  user: UserResponse;
}

export interface UserSession {
  user: UserResponse;
  accessToken: string;
  loggedInAt: string;
}

export const SEEDER_ACCOUNTS = [
  {
    username: "penilai",
    password: "penilai123",
    email: "penilai@jatinangor-dss.id",
    full_name: "Dr. Ir. Hendra (Penilai Kriteria)",
    role: "PENILAI" as UserRole,
    label: "Penilai kriteria",
  },
  {
    username: "pju_lead",
    password: "pju123",
    email: "pju@jatinangor-dss.id",
    full_name: "Agus Pratama, S.T. (PJ PJU Jatinangor)",
    role: "PENANGGUNG_JAWAB_PJU" as UserRole,
    label: "Penanggung jawab PJU",
  },
  {
    username: "admin",
    password: "admin123",
    email: "admin@jatinangor-dss.id",
    full_name: "Administrator Sistem Jatinangor",
    role: "ADMIN" as UserRole,
    label: "Admin sistem",
  },
  {
    username: "operator",
    password: "operator123",
    email: "operator@jatinangor-dss.id",
    full_name: "Operator Lapangan Jatinangor",
    role: "OPERATOR" as UserRole,
    label: "Operator lapangan",
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  PENILAI: "Penilai kriteria",
  PENANGGUNG_JAWAB_PJU: "Penanggung jawab PJU",
  PJU: "Penanggung Jawab Umum",
  ADMIN: "Admin sistem",
  OPERATOR: "Operator lapangan",
};

/**
 * Helper to get currently logged in user session from cookies on the client side.
 */
export function getClientUser(): UserResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth_session="));
    if (match) {
      const session = JSON.parse(decodeURIComponent(match.split("=")[1]));
      return session?.user || null;
    }
  } catch {}
  return null;
}

/**
 * Check if the user role is authorized as ADMIN or PJU
 */
export function isPrivilegedRole(role?: UserRole | string): boolean {
  if (!role) return false;
  return role === "ADMIN" || role === "PENANGGUNG_JAWAB_PJU" || role === "PJU";
}

export type UserRole =
  | "ADMIN"
  | "PENILAI"
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
    full_name: "Agus Pratama, S.T. (PJU Jatinangor)",
    role: "PJU" as UserRole,
    label: "Penanggung Jawab Umum",
  },
  {
    username: "admin",
    password: "admin123",
    email: "admin@jatinangor-dss.id",
    full_name: "Administrator Sistem Jatinangor",
    role: "ADMIN" as UserRole,
    label: "Admin sistem",
  },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  PENILAI: "Penilai kriteria",
  PJU: "Penanggung Jawab Umum",
  ADMIN: "Admin sistem",
};
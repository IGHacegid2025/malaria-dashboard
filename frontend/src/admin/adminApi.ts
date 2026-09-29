// Author: Khadim Gueye

const API_BASE = `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}/api`;
const TOKEN_KEY = "malaria_admin_token";

export type Role = "super_admin" | "admin";

export interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  role: Role;
  is_owner: boolean;
  must_change_password: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/verify-code") onUnauthorized();
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      message = res.statusText || message;
    }
    throw new ApiError(res.status, message);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("application/json") ? res.json() : res.blob()) as Promise<T>;
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  download: async (path: string, filename: string) => {
    const blob = await request<Blob>(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function formatDate(value: string | null) {
  if (!value) return "Never";
  const d = new Date(value.replace(" ", "T"));
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const ACTION_LABELS: Record<string, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in",
  password_changed: "Changed password",
  password_reset: "Reset a password",
  user_created: "Added an admin",
  user_updated: "Updated an admin",
  user_role_changed: "Changed a role",
  user_removed: "Removed an admin",
  user_reactivated: "Reactivated an admin",
  data_uploaded: "Submitted data",
  upload_hidden: "Hid an upload",
  upload_restored: "Restored an upload",
  record_hidden: "Hid a record",
  record_restored: "Restored a record",
  threshold_updated: "Edited WHO thresholds",
  threshold_created: "Added a specific threshold rule",
  threshold_removed: "Removed a specific threshold rule",
  settings_updated: "Edited site settings",
  media_uploaded: "Uploaded an image or video",
  team_member_added: "Added a team member",
  team_member_updated: "Edited a team member",
  team_member_removed: "Removed a team member",
  team_member_restored: "Restored a team member",
  team_member_deleted: "Deleted a team member (record kept)",
  team_reordered: "Changed the order of the team",
  team_member_to_alumni: "Moved a member to alumni",
  team_member_back_to_team: "Moved an alumnus back to the team",
  activity_added: "Added a lab activity",
  activity_updated: "Edited a lab activity",
  activity_removed: "Archived a lab activity",
  activity_restored: "Restored a lab activity",
  activity_deleted: "Deleted a lab activity (record kept)",
  activities_reordered: "Changed the order of the lab activities",
  partner_added: "Added a project or partner",
  partner_updated: "Edited a project or partner",
  partner_shown: "Showed a project or partner on the website",
  partner_hidden: "Hid a project or partner",
  partners_reordered: "Changed the order of projects and partners",
  partner_deleted: "Deleted a project or partner (record kept)",
  partner_restored: "Restored a project or partner",
  report_downloads_exported: "Exported the report downloads list",
  gene_flow_uploaded: "Published a gene flow network",
  gene_flow_hidden: "Hid a gene flow network",
  gene_flow_restored: "Restored a gene flow network",
};

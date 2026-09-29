// Author: Khadim Gueye

let names: Intl.DisplayNames | null = null;
try {
  names = new Intl.DisplayNames(["en"], { type: "region" });
} catch {
  names = null;
}

export function countryName(code: string | null | undefined) {
  if (!code || code === "UNKNOWN") return "Unknown";
  if (code === "LOCAL") return "Local network";
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function flag(code: string | null | undefined) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function place(city: string | null, region: string | null, code: string | null) {
  const parts = [city?.replace(/\s*\(.*\)$/, ""), region && region !== city ? region : null, countryName(code)].filter(Boolean);
  return parts.join(", ");
}

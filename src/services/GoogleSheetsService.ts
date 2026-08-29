/**
 * GoogleSheetsService.ts
 *
 * Real Google Sheets API v4 client for the daily performance dashboard.
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID to be set in .env.
 * Will throw a clear error if either is missing.
 */

import { env } from "lua-cli";
import { createSign } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

export interface PerformanceEntry {
  date: string;
  teamLeadId: string;
  teamLeadName: string;
  memberId: string;
  memberName: string;
  accomplishments: string;
  blockers: string;
  rating: number; // 1–5
  submittedAt: string;
}

export interface WeeklySummary {
  teamLeadId?: string;
  teamName?: string;
  weekStartDate: string;
  totalEntries: number;
  averageRating: number;
  topPerformers: Array<{ name: string; avgRating: number }>;
  commonBlockers: string[];
  entries: PerformanceEntry[];
}

// ─── Load service account JSON ─────────────────────────────────────────
function loadServiceAccountJson(): string {
  // 1. Try Lua Cloud env() (works in production)
  const fromCloudEnv = env("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (fromCloudEnv) return fromCloudEnv;

  // 2. Try process.env (works when dotenv parses it correctly)
  const fromProcessEnv = process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
  if (fromProcessEnv) return fromProcessEnv;

  // 3. Try local google-sa.json file (reliable sandbox fallback)
  const filePath = resolve(process.cwd(), "google-sa.json");
  if (existsSync(filePath)) {
    return readFileSync(filePath, "utf-8").trim();
  }

  throw new Error(
    "Google credentials not found. Either:\n" +
    "  (a) Set GOOGLE_SERVICE_ACCOUNT_JSON via: lua env sandbox -k GOOGLE_SERVICE_ACCOUNT_JSON -v '<json>'\n" +
    "  (b) Create a google-sa.json file in the project root with the service account JSON"
  );
}

// ─── JWT token generation for Google Service Account ─────────────────────────
async function getGoogleAccessToken(): Promise<string> {
  // env() reads from Lua Cloud vars; process.env fallback covers local sandbox mode
  const saJson = loadServiceAccountJson();

  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(saJson) as { client_email: string; private_key: string };
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Ensure it is minified on one line.");
  }

  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields: client_email and private_key.");
  }

  // ─── CRITICAL FIX: Lua Cloud env storage double-escapes \n in the RSA key.
  // The PEM key requires real newlines, not the literal 4-char sequence "\\n".
  const privateKey = sa.private_key.replace(/\\n/g, "\n");

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).toString("base64url");

  let signature: string;
  try {
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    signature = sign.sign(privateKey, "base64url");
  } catch (e) {
    throw new Error(
      `Google JWT signing failed — the RSA private key may be malformed. ` +
      `Key starts with: '${privateKey.slice(0, 40)}...' Error: ${String(e)}`
    );
  }

  const jwt = `${header}.${payload}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    throw new Error(`Google Auth failed (HTTP ${resp.status}) for ${sa.client_email}: ${err}`);
  }

  const data = await resp.json() as { access_token: string };
  if (!data.access_token) {
    throw new Error(`Google Auth returned no access_token for ${sa.client_email}. Response: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}


class GoogleSheetsService {
  private get sheetId(): string {
    const id = env("GOOGLE_SHEET_ID") || process.env["GOOGLE_SHEET_ID"];
    if (!id) throw new Error("GOOGLE_SHEET_ID is not set in Lua Cloud env or .env file.");
    return id;
  }

  // ─── Append rows ───────────────────────────────────────────────────────────

  async appendRows(entries: PerformanceEntry[]): Promise<{ rowsAdded: number; sheetUrl: string }> {
    const token = await getGoogleAccessToken();
    const values = entries.map((e) => [
      e.date, e.teamLeadId, e.teamLeadName, e.memberId, e.memberName,
      e.accomplishments, e.blockers, String(e.rating), e.submittedAt,
    ]);

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`Google Sheets append failed (HTTP ${resp.status}): ${err}`);
    }

    return {
      rowsAdded: entries.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit`,
    };
  }

  // ─── Get weekly summary ────────────────────────────────────────────────────

  async getWeeklySummary(teamLeadId?: string, weekStartDate?: string): Promise<WeeklySummary> {
    const weekStart = weekStartDate ?? this.getWeekStart();
    const token = await getGoogleAccessToken();

    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/Sheet1!A:I`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      throw new Error(`Google Sheets read failed (HTTP ${resp.status}): ${err}`);
    }

    const data = await resp.json() as { values?: string[][] };
    const rows = (data.values ?? []).slice(1); // skip header row

    const entries: PerformanceEntry[] = rows.map((row) => ({
      date: row[0] ?? "",
      teamLeadId: row[1] ?? "",
      teamLeadName: row[2] ?? "",
      memberId: row[3] ?? "",
      memberName: row[4] ?? "",
      accomplishments: row[5] ?? "",
      blockers: row[6] ?? "",
      rating: Number(row[7] ?? 0),
      submittedAt: row[8] ?? "",
    }));

    const filtered = entries.filter((e) => {
      const matchLead = !teamLeadId || e.teamLeadId === teamLeadId;
      const matchWeek = e.date >= weekStart;
      return matchLead && matchWeek;
    });

    const totalEntries = filtered.length;
    const avgRating = totalEntries > 0
      ? Math.round((filtered.reduce((sum, e) => sum + e.rating, 0) / totalEntries) * 10) / 10
      : 0;

    const memberRatings: Record<string, { total: number; count: number; name: string }> = {};
    for (const e of filtered) {
      if (!memberRatings[e.memberId]) memberRatings[e.memberId] = { total: 0, count: 0, name: e.memberName };
      memberRatings[e.memberId].total += e.rating;
      memberRatings[e.memberId].count += 1;
    }

    const topPerformers = Object.values(memberRatings)
      .map((m) => ({ name: m.name, avgRating: Math.round((m.total / m.count) * 10) / 10 }))
      .sort((a, b) => b.avgRating - a.avgRating)
      .slice(0, 3);

    const blockers = filtered
      .map((e) => e.blockers)
      .filter((b) => b && b.toLowerCase() !== "none" && b.trim().length > 0);

    return { teamLeadId, weekStartDate: weekStart, totalEntries, averageRating: avgRating, topPerformers, commonBlockers: blockers, entries: filtered };
  }

  private getWeekStart(): string {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay()); // KSA workweek starts Sunday
    return d.toISOString().split("T")[0];
  }
}

export const googleSheets = new GoogleSheetsService();

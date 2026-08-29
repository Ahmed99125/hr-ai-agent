/**
 * DiagnoseSheetsTool.ts
 *
 * Temporary diagnostic tool — reveals exactly what env vars
 * are visible to the tool runtime and where the Sheets auth breaks.
 * Remove after debugging.
 */
import { LuaTool, env } from "lua-cli";
import { z } from "zod";
import { createSign } from "crypto";

export class DiagnoseSheetsTool implements LuaTool {
  name = "diagnose_sheets";
  description = "Diagnose Google Sheets connectivity — shows exactly which step fails. Use this when the performance check-in is not working.";

  inputSchema = z.object({
    dummy: z.string().optional().describe("Type anything, e.g. 'run'"),
  });

  async execute(_input: z.infer<typeof this.inputSchema>) {
    const results: string[] = [];

    // Step 1: Check env vars (try Lua Cloud env first, then process.env from .env injection)
    const saJson = env("GOOGLE_SERVICE_ACCOUNT_JSON") || process.env["GOOGLE_SERVICE_ACCOUNT_JSON"];
    const sheetId = env("GOOGLE_SHEET_ID") || process.env["GOOGLE_SHEET_ID"];

    results.push(`GOOGLE_SHEET_ID: ${sheetId ? "✅ YES (length=" + sheetId.length + ")" : "❌ MISSING"}`);
    results.push(`GOOGLE_SERVICE_ACCOUNT_JSON: ${saJson ? "✅ YES (length=" + saJson.length + ")" : "❌ MISSING"}`);
    results.push(`Source — env() GOOGLE_SA: ${env("GOOGLE_SERVICE_ACCOUNT_JSON") ? "cloud" : "process.env"}`);

    if (!saJson) return { step: "env_check", results, verdict: "❌ GOOGLE_SERVICE_ACCOUNT_JSON is missing from BOTH env() and process.env. Check your .env file." };


    // Step 2: JSON parse
    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(saJson) as { client_email: string; private_key: string };
      results.push(`JSON.parse: ✅ OK — email: ${sa.client_email}`);
    } catch (e) {
      return { step: "json_parse", results, verdict: `❌ JSON.parse failed: ${String(e)}. First 100 chars: ${saJson.slice(0, 100)}` };
    }

    // Step 3: Check private key
    const rawKey = sa.private_key ?? "";
    results.push(`private_key length: ${rawKey.length}`);
    results.push(`private_key starts with: '${rawKey.slice(0, 30)}'`);
    results.push(`Contains literal \\\\n: ${rawKey.includes("\\n") ? "YES → will normalize" : "NO"}`);
    results.push(`Contains real newlines: ${rawKey.includes("\n") ? "YES" : "NO"}`);

    const privateKey = rawKey.replace(/\\n/g, "\n");

    // Step 4: JWT sign
    let jwt: string;
    try {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now, exp: now + 3600,
      })).toString("base64url");
      const sign = createSign("RSA-SHA256");
      sign.update(`${header}.${payload}`);
      const sig = sign.sign(privateKey, "base64url");
      jwt = `${header}.${payload}.${sig}`;
      results.push(`JWT signing: ✅ OK (JWT length=${jwt.length})`);
    } catch (e) {
      return { step: "jwt_sign", results, verdict: `❌ JWT signing failed: ${String(e)}` };
    }

    // Step 5: Google OAuth token
    try {
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      const data = await resp.json() as { access_token?: string; error?: string };
      results.push(`OAuth status: ${resp.status}`);
      if (!data.access_token) {
        return { step: "oauth", results, verdict: `❌ OAuth failed: ${JSON.stringify(data)}` };
      }
      results.push(`OAuth token: ✅ Got access token`);

      // Step 6: Sheets append test
      const testResp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ values: [["DIAG_TEST", "0", "DiagTest", "0", "Test", "Diagnostics run", "None", "5", new Date().toISOString()]] }),
        }
      );
      results.push(`Sheets append status: ${testResp.status}`);
      if (!testResp.ok) {
        const errBody = await testResp.text().catch(() => "");
        return { step: "sheets_append", results, verdict: `❌ Sheets append failed: HTTP ${testResp.status} — ${errBody.slice(0, 200)}` };
      }
      results.push(`Sheets append: ✅ SUCCESS`);
    } catch (e) {
      return { step: "network", results, verdict: `❌ Network error: ${String(e)}` };
    }

    return {
      step: "all_pass",
      results,
      verdict: "✅ Everything works! Google Sheets is fully connected and writing successfully.",
    };
  }
}

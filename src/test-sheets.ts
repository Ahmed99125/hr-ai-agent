import { createSign } from "crypto";
import { config } from "dotenv";
config();

const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
const sa = JSON.parse(saJson) as { client_email: string; private_key: string };

const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({
  iss: sa.client_email,
  scope: "https://www.googleapis.com/auth/spreadsheets",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
})).toString("base64url");

const sign = createSign("RSA-SHA256");
sign.update(`${header}.${payload}`);
const signature = sign.sign(sa.private_key, "base64url");
const jwt = `${header}.${payload}.${signature}`;

const authResp = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
});

const authData = await authResp.json() as { access_token?: string; error?: string };
console.log("Auth status:", authResp.status);

if (!authData.access_token) {
  console.error("❌ Auth failed:", JSON.stringify(authData));
  process.exit(1);
}
console.log("✅ Got access token");

const sheetId = process.env.GOOGLE_SHEET_ID!;
const appendResp = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${authData.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [["2026-08-29","1001","Omar Al-Shareef","119","Ahmed Tamer","Completed 5 client deliverables","None","5", new Date().toISOString()]] }),
  }
);

const appendData = await appendResp.json();
console.log("Append status:", appendResp.status);
if (appendResp.ok) {
  console.log("✅ Row appended successfully!");
  console.log("Sheet URL: https://docs.google.com/spreadsheets/d/" + sheetId + "/edit");
} else {
  console.error("❌ Append failed:", JSON.stringify(appendData).slice(0, 500));
}

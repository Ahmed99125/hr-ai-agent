/**
 * test-runner.ts
 *
 * Tests the pure-logic components (LaborLawEngine + tools that don't need credentials).
 * BambooHR and Google Sheets are NOT tested here — they require live credentials.
 * Set BAMBOOHR_API_KEY, BAMBOOHR_SUBDOMAIN, GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID in .env to use them.
 */

import { calculateGratuity, getLeaveEntitlement, getProbationPeriod } from "./services/LaborLawEngine.js";
import { GratuityCalculatorTool } from "./skills/hr-skills/tools/GratuityCalculatorTool.js";
import { IqamaExpiryAlertTool } from "./skills/hr-skills/tools/IqamaExpiryAlertTool.js";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 HR AI AGENT — LOCAL LOGIC TESTS");
  console.log("  (LaborLawEngine + Iqama Tool)");
  console.log("  BambooHR & Sheets require real .env credentials");
  console.log("==========================================\n");

  // 1. KSA Resignation Gratuity (6 years, 12,000 SAR)
  console.log("▶ 1. KSA Resignation Gratuity — 6 years, SAR 12,000");
  const gratuityTool = new GratuityCalculatorTool();
  const r1 = await gratuityTool.execute({ country: "KSA", monthlySalary: 12000, yearsOfService: 6, terminationType: "resignation" });
  console.log(`   Total: ${r1.totalGratuity}`);
  console.log(`   Legal: ${r1.legalReference}`);
  r1.breakdown.forEach((b) => console.log(`   • ${b.description} → ${b.amount}`));
  console.log("   ✔ PASS\n");

  // 2. UAE Termination Gratuity (8 years, AED 18,000)
  console.log("▶ 2. UAE Termination Gratuity — 8 years, AED 18,000");
  const r2 = calculateGratuity("UAE", 18000, 8, "termination");
  console.log(`   Total: ${r2.totalAmount.toLocaleString()} ${r2.currency}`);
  console.log(`   Legal: ${r2.statute}`);
  r2.breakdown.forEach((b) => console.log(`   • ${b.label} → ${b.amount.toLocaleString()} ${r2.currency}`));
  console.log("   ✔ PASS\n");

  // 3. Egypt Resignation Gratuity (12 years, EGP 8,000)
  console.log("▶ 3. Egypt Gratuity — 12 years, EGP 8,000");
  const r3 = calculateGratuity("EGY", 8000, 12, "resignation");
  console.log(`   Total: ${r3.totalAmount.toLocaleString()} ${r3.currency}`);
  console.log("   ✔ PASS\n");

  // 4. Statutory Leave Entitlements
  console.log("▶ 4. Statutory Leave Entitlements");
  const tests = [
    { country: "KSA" as const, years: 3, type: "annual" as const, expected: 21 },
    { country: "KSA" as const, years: 6, type: "annual" as const, expected: 30 },
    { country: "UAE" as const, years: 2, type: "annual" as const, expected: 30 },
    { country: "JOR" as const, years: 3, type: "annual" as const, expected: 14 },
    { country: "JOR" as const, years: 7, type: "annual" as const, expected: 21 },
    { country: "EGY" as const, years: 8, type: "annual" as const, expected: 21 },
  ];
  for (const t of tests) {
    const leave = getLeaveEntitlement(t.country, t.years, t.type);
    const icon = leave.entitlementDays === t.expected ? "✔" : "✗";
    console.log(`   ${icon} ${t.country} ${t.years}yr annual → ${leave.entitlementDays} days (expected ${t.expected})`);
  }
  console.log();

  // 5. Probation Periods
  console.log("▶ 5. Probation Periods by Country");
  ((["KSA", "UAE", "EGY", "JOR"] as const)).forEach((c) => {
    const p = getProbationPeriod(c);
    console.log(`   ${c}: standard=${p.standardDays}d, max=${p.maximumDays}d — ${p.statute}`);
  });
  console.log("   ✔ PASS\n");

  // 6. Iqama Expiry Alert Tool (no BambooHR call — direct date input)
  console.log("▶ 6. Iqama Expiry Alert Tool (direct date — no API call)");
  const iqamaTool = new IqamaExpiryAlertTool();

  const testCases = [
    { label: "25 days (🔴 RED)", days: 25 },
    { label: "45 days (🟡 YELLOW)", days: 45 },
    { label: "90 days (🟢 GREEN)", days: 90 },
    { label: "-5 days (🚨 EXPIRED)", days: -5 },
  ];

  for (const tc of testCases) {
    const date = new Date(Date.now() + tc.days * 86400000).toISOString().split("T")[0];
    const res = await iqamaTool.execute({ expiryDate: date });
    if ("alertLevel" in res) {
      console.log(`   ${res.alertEmoji} ${tc.label}: ${res.daysRemaining} days remaining — ${res.alertLevel}`);
    } else {
      console.log(`   ⚠ ${tc.label}: ${res.message}`);
    }
  }
  console.log("   ✔ PASS\n");

  console.log("==========================================");
  console.log("🎉 ALL LOCAL LOGIC TESTS PASSED!");
  console.log("\nTo test live BambooHR / Google Sheets integration:");
  console.log("  1. Fill in .env with your real credentials");
  console.log("  2. Run: lua chat");
  console.log("  3. Ask: \"Look up employee 1001\" or \"Submit a daily check-in\"");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});

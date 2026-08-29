import { bambooHR } from "./services/BambooHRService.js";
import { googleSheets } from "./services/GoogleSheetsService.js";
import { GratuityCalculatorTool } from "./skills/hr-skills/tools/GratuityCalculatorTool.js";
import { IqamaExpiryAlertTool } from "./skills/hr-skills/tools/IqamaExpiryAlertTool.js";

async function verifyLiveAPIs() {
  console.log("==========================================");
  console.log("🚀 TESTING REAL BAMBOOHR & GOOGLE SHEETS APIS");
  console.log("==========================================\n");

  // 1. Test BambooHR Employee Directory
  console.log("▶ 1. Testing BambooHR Live Directory API (Subdomain: ischool)...");
  try {
    const employees = await bambooHR.getAllEmployees();
    console.log(`✅ BambooHR Connected! Retrieved ${employees.length} employees from directory.`);
    if (employees.length > 0) {
      console.log("   First employee sample:", employees[0]);
    }
  } catch (err: any) {
    console.error("❌ BambooHR API Error:", err.message);
  }

  // 2. Test Google Sheets API
  console.log("\n▶ 2. Testing Google Sheets Live API...");
  try {
    const appendResult = await googleSheets.appendRows([
      {
        date: new Date().toISOString().split("T")[0],
        teamLeadId: "TL-001",
        teamLeadName: "HR Agent Test",
        memberId: "EMP-001",
        memberName: "Verification Check",
        accomplishments: "Successfully validated live Google Sheets API connectivity",
        blockers: "None",
        rating: 5,
        submittedAt: new Date().toISOString(),
      },
    ]);
    console.log("✅ Google Sheets Connected! Added test performance row.");
    console.log("   Sheet URL:", appendResult.sheetUrl);
  } catch (err: any) {
    console.error("❌ Google Sheets API Error:", err.message);
  }

  // 3. Test Gratuity calculation
  console.log("\n▶ 3. Testing Gratuity Tool...");
  const tool = new GratuityCalculatorTool();
  const res = await tool.execute({
    country: "KSA",
    monthlySalary: 15000,
    yearsOfService: 5,
    terminationType: "termination",
  });
  console.log(`✅ Gratuity Tool: ${res.totalGratuity} (${res.legalReference})`);

  console.log("\n==========================================");
  console.log("🏁 LIVE API VERIFICATION COMPLETE");
  console.log("==========================================");
}

verifyLiveAPIs().catch(console.error);

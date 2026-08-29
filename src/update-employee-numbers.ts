/**
 * update-employee-numbers.ts
 *
 * Sets the 'employeeNumber' (Badge #) field in BambooHR for employees 119-124
 * so the "Employee #" column in the web dashboard is populated.
 */

import { env } from "lua-cli";

const EMPLOYEES_TO_UPDATE = [
  { id: "119", employeeNumber: "1001", department: "Engineering", jobTitle: "Senior Petroleum Engineer" },
  { id: "120", employeeNumber: "1002", department: "Operations", jobTitle: "Mechanical Maintenance Specialist" },
  { id: "121", employeeNumber: "1003", department: "Operations", jobTitle: "Plant Operations Director" },
  { id: "122", employeeNumber: "1004", department: "Human Resources", jobTitle: "Talent Acquisition Specialist" },
  { id: "123", employeeNumber: "1005", department: "Logistics", jobTitle: "Supply Chain Lead" },
  { id: "124", employeeNumber: "1006", department: "Engineering", jobTitle: "Junior Mechanical Engineer" },
];

async function updateEmployeeNumbers() {
  const apiKey = env("BAMBOOHR_API_KEY");
  const subdomain = env("BAMBOOHR_SUBDOMAIN");

  if (!apiKey || !subdomain) {
    throw new Error("Missing BAMBOOHR_API_KEY or BAMBOOHR_SUBDOMAIN in .env");
  }

  const encoded = Buffer.from(`${apiKey}:x`).toString("base64");
  const baseUrl = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1`;

  console.log("================================================================");
  console.log(`📝 UPDATING EMPLOYEE NUMBERS (BADGE #) IN BAMBOOHR (${subdomain})`);
  console.log("================================================================\n");

  for (const emp of EMPLOYEES_TO_UPDATE) {
    console.log(`▶ Updating Record #${emp.id} → Setting Employee # to '${emp.employeeNumber}'...`);
    try {
      const resp = await fetch(`${baseUrl}/employees/${emp.id}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${encoded}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeNumber: emp.employeeNumber,
          department: emp.department,
          jobTitle: emp.jobTitle,
        }),
      });

      if (resp.status === 200 || resp.status === 201) {
        console.log(`   ✅ Success! Employee #${emp.employeeNumber} updated in dashboard.`);
      } else {
        const txt = await resp.text();
        console.warn(`   ⚠️ Status ${resp.status}: ${txt}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Failed for ${emp.id}:`, err.message);
    }
  }

  console.log("\n================================================================");
  console.log("🎉 ALL EMPLOYEE NUMBERS POPULATED! Refresh your BambooHR page.");
  console.log("================================================================");
}

updateEmployeeNumbers().catch(console.error);

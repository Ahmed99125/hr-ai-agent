/**
 * seed-bamboohr.ts
 *
 * Seeds comprehensive test employees into your BambooHR account.
 * Covers all 4 conglomerate countries (KSA, UAE, Egypt, Jordan) and scenarios
 * needed for Onboarding, Leave, Gratuity, Iqama Expiry, and Performance workflows.
 *
 * Run with:
 *   npx tsc; node --env-file=.env dist/seed-bamboohr.js
 */

import { env } from "lua-cli";

interface ComprehensiveEmployee {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  workEmail: string;
  hireDate: string;
  country: string;
  location: string;
  gender?: "Male" | "Female";
  maritalStatus?: "Single" | "Married";
  supervisor?: string;
  scenarioDescription: string;
}

const EMPLOYEES_TO_SEED: ComprehensiveEmployee[] = [
  {
    firstName: "Ahmed",
    lastName: "Al-Rashidi",
    jobTitle: "Senior Petroleum Engineer",
    department: "Engineering",
    workEmail: "ahmed.alrashidi@company-demo.com",
    hireDate: "2019-03-15", // ~7 years tenure: triggers Art. 84 tier 2 & Art. 85 2/3 multiplier
    country: "Saudi Arabia",
    location: "Riyadh HQ",
    gender: "Male",
    maritalStatus: "Married",
    scenarioDescription: "KSA Senior Engineer (7 yrs) — Test Gratuity (Art. 84/85) & 30-day Annual Leave (Art. 109)",
  },
  {
    firstName: "Tariq",
    lastName: "Mansoor",
    jobTitle: "Mechanical Maintenance Specialist",
    department: "Operations",
    workEmail: "tariq.mansoor@company-demo.com",
    hireDate: "2022-05-10",
    country: "Saudi Arabia",
    location: "Riyadh HQ",
    gender: "Male",
    maritalStatus: "Single",
    scenarioDescription: "KSA Expatriate Specialist — Test Iqama Expiry Alert (Yellow/Red alert levels) & Absher Renewal",
  },
  {
    firstName: "Sara",
    lastName: "Al-Maktoum",
    jobTitle: "Plant Operations Director",
    department: "Operations",
    workEmail: "sara.almaktoum@company-demo.com",
    hireDate: "2018-01-10", // 8 years tenure
    country: "United Arab Emirates",
    location: "Dubai Plant",
    gender: "Female",
    maritalStatus: "Married",
    scenarioDescription: "UAE Plant Director (8 yrs) — Test UAE Labor Law No. 33 Gratuity (21d/30d tiers) & 30d Annual Leave",
  },
  {
    firstName: "Nour",
    lastName: "Ibrahim",
    jobTitle: "Talent Acquisition Specialist",
    department: "Human Resources",
    workEmail: "nour.ibrahim@company-demo.com",
    hireDate: "2023-11-01",
    country: "Egypt",
    location: "Alexandria Hub",
    gender: "Female",
    maritalStatus: "Single",
    scenarioDescription: "Egypt HR Specialist — Test Egypt Law No. 12 Leave rules (21 working days) & Social Insurance",
  },
  {
    firstName: "Omar",
    lastName: "Al-Khatib",
    jobTitle: "Supply Chain & Logistics Lead",
    department: "Logistics",
    workEmail: "omar.khatib@company-demo.com",
    hireDate: "2020-06-15", // 5+ years tenure
    country: "Jordan",
    location: "Amman Center",
    gender: "Male",
    maritalStatus: "Married",
    scenarioDescription: "Jordan Logistics Lead — Test Jordan Law No. 8 Leave (21 days for 5+ yrs) & 1 month/yr Gratuity",
  },
  {
    firstName: "Youssef",
    lastName: "Al-Amin",
    jobTitle: "Junior Mechanical Engineer",
    department: "Engineering",
    workEmail: "youssef.alamin@company-demo.com",
    hireDate: new Date().toISOString().split("T")[0], // Joined today!
    country: "Saudi Arabia",
    location: "Riyadh HQ",
    gender: "Male",
    maritalStatus: "Single",
    scenarioDescription: "New Joiner (Today) — Test Onboarding Workflow (Checklist trigger, IBAN/Iqama validation, Orientation)",
  },
];

async function seedBambooHR() {
  const apiKey = env("BAMBOOHR_API_KEY");
  const subdomain = env("BAMBOOHR_SUBDOMAIN");

  if (!apiKey || !subdomain) {
    throw new Error("Missing BAMBOOHR_API_KEY or BAMBOOHR_SUBDOMAIN in .env");
  }

  const encoded = Buffer.from(`${apiKey}:x`).toString("base64");
  const baseUrl = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1`;

  console.log("================================================================");
  console.log(`🌱 SEEDING CONGLOMERATE EMPLOYEES INTO BAMBOOHR (${subdomain})`);
  console.log("================================================================\n");

  const createdSummary: Array<{ id: string; name: string; country: string; scenario: string }> = [];

  for (const emp of EMPLOYEES_TO_SEED) {
    const { scenarioDescription, ...payload } = emp;
    console.log(`▶ Adding: ${emp.firstName} ${emp.lastName} (${emp.jobTitle} - ${emp.location})`);
    console.log(`   💡 Purpose: ${scenarioDescription}`);

    try {
      const resp = await fetch(`${baseUrl}/employees`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${encoded}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (resp.status === 201) {
        const locationHeader = resp.headers.get("location") || "";
        const newId = locationHeader.split("/").pop() || "created";
        console.log(`   ✅ Success! Created with Employee ID: ${newId}\n`);
        createdSummary.push({
          id: newId,
          name: `${emp.firstName} ${emp.lastName}`,
          country: emp.country,
          scenario: scenarioDescription,
        });
      } else {
        const errorText = await resp.text();
        console.warn(`   ⚠️ Status ${resp.status}: ${errorText}\n`);
      }
    } catch (err: any) {
      console.error(`   ❌ Failed to create ${emp.firstName}:`, err.message, "\n");
    }
  }

  console.log("================================================================");
  console.log("🎉 SEEDING COMPLETE! SUMMARY OF CREATED EMPLOYEES:");
  console.log("================================================================");
  console.table(createdSummary);
  console.log("\n💡 You can now query any of these employees in 'lua chat' using their ID or Name!");
}

seedBambooHR().catch(console.error);

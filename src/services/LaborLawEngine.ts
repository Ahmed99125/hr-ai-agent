/**
 * LaborLawEngine.ts
 *
 * Pure TypeScript statutory rules engine for KSA, UAE, Egypt, and Jordan.
 * No external API calls — all calculations are based on applicable labor codes.
 */

export type Country = "KSA" | "UAE" | "EGY" | "JOR";
export type TerminationType = "termination" | "resignation" | "contract_end" | "mutual_agreement" | "retirement";
export type LeaveType = "annual" | "sick" | "emergency" | "maternity" | "paternity" | "hajj" | "unpaid";

// ─────────────────────────────────────────────────────────────────────────────
// GRATUITY (End-of-Service Benefits)
// ─────────────────────────────────────────────────────────────────────────────

export interface GratuityResult {
  country: Country;
  totalAmount: number;
  currency: string;
  breakdown: GratuityTier[];
  statute: string;
  notes: string[];
  terminationType: TerminationType;
  yearsOfService: number;
  monthlySalary: number;
}

export interface GratuityTier {
  label: string;
  years: number;
  rate: string;
  amount: number;
}

/**
 * Calculate end-of-service gratuity per country & termination type.
 */
export function calculateGratuity(
  country: Country,
  monthlySalary: number,
  yearsOfService: number,
  terminationType: TerminationType
): GratuityResult {
  const currency = { KSA: "SAR", UAE: "AED", EGY: "EGP", JOR: "JOD" }[country];

  switch (country) {
    case "KSA":
      return calculateKSAGratuity(monthlySalary, yearsOfService, terminationType, currency);
    case "UAE":
      return calculateUAEGratuity(monthlySalary, yearsOfService, terminationType, currency);
    case "EGY":
      return calculateEGYGratuity(monthlySalary, yearsOfService, terminationType, currency);
    case "JOR":
      return calculateJORGratuity(monthlySalary, yearsOfService, terminationType, currency);
  }
}

// ─── KSA: Saudi Labor Law Articles 84 & 85 ───────────────────────────────────

function calculateKSAGratuity(
  salary: number,
  years: number,
  terminationType: TerminationType,
  currency: string
): GratuityResult {
  const breakdown: GratuityTier[] = [];
  const notes: string[] = [];

  if (years < 2 && terminationType === "resignation") {
    return {
      country: "KSA",
      totalAmount: 0,
      currency,
      breakdown: [],
      statute: "Saudi Labor Law, Article 85",
      notes: ["No gratuity is payable for resignations with less than 2 years of service."],
      terminationType,
      yearsOfService: years,
      monthlySalary: salary,
    };
  }

  // Article 84 base amount (applies to termination / contract_end / mutual_agreement / retirement)
  let art84Amount = 0;
  const firstFiveYears = Math.min(years, 5);
  const remainingYears = Math.max(years - 5, 0);

  if (firstFiveYears > 0) {
    const amount = (salary / 2) * firstFiveYears;
    art84Amount += amount;
    breakdown.push({
      label: `First ${firstFiveYears} year(s) — ½ month per year (Art. 84)`,
      years: firstFiveYears,
      rate: "½ monthly salary per year",
      amount,
    });
  }

  if (remainingYears > 0) {
    const amount = salary * remainingYears;
    art84Amount += amount;
    breakdown.push({
      label: `Remaining ${remainingYears} year(s) beyond 5 — 1 month per year (Art. 84)`,
      years: remainingYears,
      rate: "1 monthly salary per year",
      amount,
    });
  }

  // Article 85: apply resignation multiplier
  let totalAmount = art84Amount;
  let statute = "Saudi Labor Law, Article 84";

  if (terminationType === "resignation") {
    statute = "Saudi Labor Law, Article 85";
    let multiplier = 1;
    let multiplierLabel = "";

    if (years >= 2 && years < 5) {
      multiplier = 1 / 3;
      multiplierLabel = "⅓ (resignation with 2–5 years service)";
    } else if (years >= 5 && years < 10) {
      multiplier = 2 / 3;
      multiplierLabel = "⅔ (resignation with 5–10 years service)";
    } else {
      multiplier = 1;
      multiplierLabel = "Full (resignation with 10+ years service)";
    }

    totalAmount = art84Amount * multiplier;
    breakdown.push({
      label: `Article 85 resignation multiplier: ${multiplierLabel}`,
      years: 0,
      rate: `× ${multiplier.toFixed(4)}`,
      amount: totalAmount - art84Amount,
    });
    notes.push(`Resignation with ${years} year(s) of service applies a ${multiplierLabel} multiplier per Article 85.`);
  }

  if (terminationType === "termination" || terminationType === "contract_end") {
    notes.push("Full Article 84 gratuity applies. Employee may also be entitled to compensation under Article 77 if terminated without valid reason.");
  }

  notes.push("Gratuity is calculated on last drawn basic salary (excluding allowances) unless employment contract states otherwise.");

  return {
    country: "KSA",
    totalAmount: Math.round(totalAmount * 100) / 100,
    currency,
    breakdown,
    statute,
    notes,
    terminationType,
    yearsOfService: years,
    monthlySalary: salary,
  };
}

// ─── UAE: Federal Decree-Law No. 33 of 2021 ──────────────────────────────────

function calculateUAEGratuity(
  salary: number,
  years: number,
  terminationType: TerminationType,
  currency: string
): GratuityResult {
  const breakdown: GratuityTier[] = [];

  if (years < 1) {
    return {
      country: "UAE",
      totalAmount: 0,
      currency,
      breakdown: [],
      statute: "UAE Federal Decree-Law No. 33 of 2021, Article 51",
      notes: ["No gratuity is payable for service less than 1 year."],
      terminationType,
      yearsOfService: years,
      monthlySalary: salary,
    };
  }

  const dailySalary = (salary * 12) / 365;
  const firstFiveYears = Math.min(years, 5);
  const remainingYears = Math.max(years - 5, 0);

  let total = 0;

  if (firstFiveYears > 0) {
    const amount = dailySalary * 21 * firstFiveYears;
    total += amount;
    breakdown.push({
      label: `First ${firstFiveYears} year(s) — 21 calendar days per year`,
      years: firstFiveYears,
      rate: "21 days/year",
      amount,
    });
  }

  if (remainingYears > 0) {
    const amount = dailySalary * 30 * remainingYears;
    total += amount;
    breakdown.push({
      label: `Remaining ${remainingYears} year(s) — 30 calendar days per year`,
      years: remainingYears,
      rate: "30 days/year",
      amount,
    });
  }

  // Cap at 2 years' salary
  const cap = salary * 24;
  const capped = total > cap;
  if (capped) total = cap;

  return {
    country: "UAE",
    totalAmount: Math.round(total * 100) / 100,
    currency,
    breakdown,
    statute: "UAE Federal Decree-Law No. 33 of 2021, Article 51",
    notes: [
      capped ? `Gratuity has been capped at 2 years' salary (${cap} ${currency}).` : "",
      "Calculated on basic salary only, excluding allowances.",
    ].filter(Boolean),
    terminationType,
    yearsOfService: years,
    monthlySalary: salary,
  };
}

// ─── Egypt: Labour Law No. 12 of 2003 ────────────────────────────────────────

function calculateEGYGratuity(
  salary: number,
  years: number,
  terminationType: TerminationType,
  currency: string
): GratuityResult {
  const breakdown: GratuityTier[] = [];

  if (years < 1) {
    return {
      country: "EGY",
      totalAmount: 0,
      currency,
      breakdown: [],
      statute: "Egypt Labour Law No. 12 of 2003, Article 54",
      notes: ["No gratuity payable for service under 1 year."],
      terminationType,
      yearsOfService: years,
      monthlySalary: salary,
    };
  }

  const firstFiveYears = Math.min(years, 5);
  const remainingYears = Math.max(years - 5, 0);
  let total = 0;

  if (firstFiveYears > 0) {
    const amount = (salary / 2) * firstFiveYears;
    total += amount;
    breakdown.push({ label: `First ${firstFiveYears} year(s) — ½ month per year`, years: firstFiveYears, rate: "½ month/year", amount });
  }

  if (remainingYears > 0) {
    const amount = salary * remainingYears;
    total += amount;
    breakdown.push({ label: `Remaining ${remainingYears} year(s) — 1 month per year`, years: remainingYears, rate: "1 month/year", amount });
  }

  return {
    country: "EGY",
    totalAmount: Math.round(total * 100) / 100,
    currency,
    breakdown,
    statute: "Egypt Labour Law No. 12 of 2003, Article 54",
    notes: ["Gratuity is in addition to any social insurance entitlements."],
    terminationType,
    yearsOfService: years,
    monthlySalary: salary,
  };
}

// ─── Jordan: Labour Law No. 8 of 1996 (Amended) ──────────────────────────────

function calculateJORGratuity(
  salary: number,
  years: number,
  terminationType: TerminationType,
  currency: string
): GratuityResult {
  if (years < 1) {
    return {
      country: "JOR",
      totalAmount: 0,
      currency,
      breakdown: [],
      statute: "Jordan Labour Law No. 8 of 1996, Article 32",
      notes: ["No gratuity payable for service under 1 year."],
      terminationType,
      yearsOfService: years,
      monthlySalary: salary,
    };
  }

  const amount = salary * years;
  return {
    country: "JOR",
    totalAmount: Math.round(amount * 100) / 100,
    currency,
    breakdown: [{ label: `${years} year(s) × 1 month salary`, years, rate: "1 month/year", amount }],
    statute: "Jordan Labour Law No. 8 of 1996, Article 32",
    notes: ["One month's salary for each year of service."],
    terminationType,
    yearsOfService: years,
    monthlySalary: salary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE ENTITLEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaveEntitlementResult {
  country: Country;
  leaveType: LeaveType;
  entitlementDays: number;
  unit: "calendar" | "working";
  statute: string;
  notes: string[];
}

export function getLeaveEntitlement(
  country: Country,
  tenureYears: number,
  leaveType: LeaveType
): LeaveEntitlementResult {
  switch (country) {
    case "KSA":
      return getKSALeaveEntitlement(tenureYears, leaveType);
    case "UAE":
      return getUAELeaveEntitlement(tenureYears, leaveType);
    case "EGY":
      return getEGYLeaveEntitlement(tenureYears, leaveType);
    case "JOR":
      return getJORLeaveEntitlement(tenureYears, leaveType);
  }
}

function getKSALeaveEntitlement(tenureYears: number, leaveType: LeaveType): LeaveEntitlementResult {
  const base: Omit<LeaveEntitlementResult, "entitlementDays" | "statute" | "notes"> = {
    country: "KSA", leaveType, unit: "calendar",
  };

  switch (leaveType) {
    case "annual":
      return {
        ...base,
        entitlementDays: tenureYears >= 5 ? 30 : 21,
        statute: "Saudi Labor Law, Article 109",
        notes: [
          tenureYears >= 5
            ? "30 days annual leave for employees with 5+ years of service."
            : "21 days annual leave for employees with less than 5 years of service.",
        ],
      };
    case "sick":
      return {
        ...base,
        entitlementDays: 120,
        statute: "Saudi Labor Law, Article 117",
        notes: [
          "First 30 days: full pay.",
          "Next 60 days: 3/4 pay.",
          "Final 30 days: unpaid (or as per company policy).",
        ],
      };
    case "maternity":
      return { ...base, entitlementDays: 10 * 7, statute: "Saudi Labor Law, Article 151", notes: ["10 weeks paid maternity leave."] };
    case "hajj":
      return { ...base, entitlementDays: 10, statute: "Saudi Labor Law, Article 114", notes: ["10 days paid Hajj leave, once per service period."] };
    default:
      return { ...base, entitlementDays: 0, statute: "Saudi Labor Law", notes: ["Refer to HR for this leave type."] };
  }
}

function getUAELeaveEntitlement(tenureYears: number, leaveType: LeaveType): LeaveEntitlementResult {
  const base: Omit<LeaveEntitlementResult, "entitlementDays" | "statute" | "notes"> = {
    country: "UAE", leaveType, unit: "calendar",
  };
  switch (leaveType) {
    case "annual":
      return {
        ...base,
        entitlementDays: tenureYears >= 1 ? 30 : Math.floor(2.5 * Math.min(tenureYears, 1) * 12),
        statute: "UAE Federal Decree-Law No. 33 of 2021, Article 29",
        notes: ["30 calendar days per year after 1 year of service."],
      };
    case "sick":
      return { ...base, entitlementDays: 90, statute: "UAE Federal Decree-Law No. 33, Article 31", notes: ["First 15 days: full pay. Next 30 days: half pay. Remaining 45 days: unpaid."] };
    case "maternity":
      return { ...base, entitlementDays: 60, statute: "UAE Federal Decree-Law No. 33, Article 30", notes: ["60 days maternity leave (45 fully paid + 15 half pay)."] };
    default:
      return { ...base, entitlementDays: 0, statute: "UAE Federal Decree-Law No. 33", notes: ["Refer to HR for this leave type."] };
  }
}

function getEGYLeaveEntitlement(tenureYears: number, leaveType: LeaveType): LeaveEntitlementResult {
  const base: Omit<LeaveEntitlementResult, "entitlementDays" | "statute" | "notes"> = {
    country: "EGY", leaveType, unit: "working",
  };
  switch (leaveType) {
    case "annual":
      return {
        ...base,
        entitlementDays: tenureYears >= 10 ? 30 : 21,
        statute: "Egypt Labour Law No. 12 of 2003, Article 47",
        notes: [tenureYears >= 10 ? "30 working days for 10+ years of service." : "21 working days for less than 10 years of service."],
      };
    case "sick":
      return { ...base, entitlementDays: 180, statute: "Egypt Labour Law No. 12 of 2003, Article 54", notes: ["Sick leave as prescribed by Social Insurance authority; first 3 months full pay, next 3 months 75% pay."] };
    default:
      return { ...base, entitlementDays: 0, statute: "Egypt Labour Law No. 12 of 2003", notes: ["Refer to HR for this leave type."] };
  }
}

function getJORLeaveEntitlement(tenureYears: number, leaveType: LeaveType): LeaveEntitlementResult {
  const base: Omit<LeaveEntitlementResult, "entitlementDays" | "statute" | "notes"> = {
    country: "JOR", leaveType, unit: "working",
  };
  switch (leaveType) {
    case "annual":
      return {
        ...base,
        entitlementDays: tenureYears >= 5 ? 21 : 14,
        statute: "Jordan Labour Law No. 8 of 1996, Article 61",
        notes: [tenureYears >= 5 ? "21 working days for 5+ years of service." : "14 working days for less than 5 years of service."],
      };
    case "sick":
      return { ...base, entitlementDays: 14, statute: "Jordan Labour Law, Article 65", notes: ["14 days full pay, then 14 days half pay per year."] };
    default:
      return { ...base, entitlementDays: 0, statute: "Jordan Labour Law No. 8 of 1996", notes: ["Refer to HR for this leave type."] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBATION PERIODS
// ─────────────────────────────────────────────────────────────────────────────

export interface ProbationResult {
  country: Country;
  standardDays: number;
  maximumDays: number;
  statute: string;
  notes: string[];
}

export function getProbationPeriod(country: Country): ProbationResult {
  switch (country) {
    case "KSA":
      return {
        country,
        standardDays: 90,
        maximumDays: 180,
        statute: "Saudi Labor Law, Article 53",
        notes: [
          "Standard probation is 90 days.",
          "Extendable to 180 days by written mutual agreement.",
          "Employee may be terminated without notice during probation.",
        ],
      };
    case "UAE":
      return {
        country,
        standardDays: 180,
        maximumDays: 180,
        statute: "UAE Federal Decree-Law No. 33 of 2021, Article 9",
        notes: ["Maximum probation period is 6 months.", "14 days notice required by either party during probation."],
      };
    case "EGY":
      return {
        country,
        standardDays: 90,
        maximumDays: 90,
        statute: "Egypt Labour Law No. 12 of 2003, Article 28",
        notes: ["Probation period must be explicitly stated in the employment contract.", "Maximum 3 months."],
      };
    case "JOR":
      return {
        country,
        standardDays: 90,
        maximumDays: 90,
        statute: "Jordan Labour Law No. 8 of 1996, Article 31",
        notes: ["Probation must be agreed in writing.", "Maximum 3 months."],
      };
  }
}

/**
 * BambooHRService.ts
 *
 * Real BambooHR REST API client.
 * Requires BAMBOOHR_API_KEY and BAMBOOHR_SUBDOMAIN to be set in .env
 * before calling any method. Will throw a clear error if either is missing.
 */

import { env } from "lua-cli";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BHREmployee {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department: string;
  jobTitle: string;
  hireDate: string;
  country: "KSA" | "UAE" | "EGY" | "JOR";
  location: "riyadh_hq" | "dubai_plant" | "alexandria_hub" | "amman_center";
  workEmail: string;
  supervisor: string;
  supervisorId: string;
  iqamaExpiryDate?: string;
  nationality: string;
  monthlySalary: number;
  currency: string;
}

export interface TimeOffBalance {
  leaveType: string;
  balance: number;
  used: number;
  available: number;
  unit: string;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "approved" | "pending" | "declined";
  notes?: string;
}

export interface OnboardingChecklist {
  id: string;
  employeeId: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  dueDate: string;
  assignedTo: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

class BambooHRService {
  private getApiKey(): string {
    const key = env("BAMBOOHR_API_KEY");
    if (!key) throw new Error(
      "BAMBOOHR_API_KEY is not set.\n" +
      "Add it to your .env file:\n  BAMBOOHR_API_KEY=your_key_here\n" +
      "Or set it with: lua env set BAMBOOHR_API_KEY <your_key>"
    );
    return key;
  }

  private getSubdomain(): string {
    const subdomain = env("BAMBOOHR_SUBDOMAIN");
    if (!subdomain) throw new Error(
      "BAMBOOHR_SUBDOMAIN is not set.\n" +
      "Add it to your .env file:\n  BAMBOOHR_SUBDOMAIN=yourcompany\n" +
      "(This is the company slug in your BambooHR URL: https://yourcompany.bamboohr.com)"
    );
    return subdomain;
  }

  private getHeaders(): HeadersInit {
    const encoded = Buffer.from(`${this.getApiKey()}:x`).toString("base64");
    return {
      Authorization: `Basic ${encoded}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private get baseUrl(): string {
    return `https://api.bamboohr.com/api/gateway.php/${this.getSubdomain()}/v1`;
  }

  /** Normalize any BambooHR location value to our internal enum key */
  private normalizeLocation(raw: string | undefined): BHREmployee["location"] {
    if (!raw) return "riyadh_hq";
    const s = raw.toLowerCase().replace(/[\s_-]+/g, "_");
    if (s.includes("dubai") || s.includes("uae")) return "dubai_plant";
    if (s.includes("alex") || s.includes("egypt") || s.includes("egp")) return "alexandria_hub";
    if (s.includes("amman") || s.includes("jordan") || s.includes("jor")) return "amman_center";
    if (s.includes("riyadh") || s.includes("ksa") || s.includes("saudi")) return "riyadh_hq";
    // Try direct match as last resort
    const direct: Record<string, BHREmployee["location"]> = {
      riyadh_hq: "riyadh_hq",
      dubai_plant: "dubai_plant",
      alexandria_hub: "alexandria_hub",
      amman_center: "amman_center",
    };
    return direct[s] ?? "riyadh_hq";
  }

  // ─── Get Employee ─────────────────────────────────────────────────────────

  async getEmployee(employeeId: string): Promise<BHREmployee> {
    const resp = await fetch(
      `${this.baseUrl}/employees/${employeeId}` +
      `?fields=firstName,lastName,department,jobTitle,hireDate,workEmail,` +
      `supervisorId,supervisor,country,location,nationality,customIqamaExpiryDate,currency`,
      { headers: this.getHeaders() }
    );
    if (!resp.ok) throw new Error(`BambooHR: Employee ${employeeId} not found (HTTP ${resp.status})`);
    const data = await resp.json() as Record<string, string>;
    return {
      id: employeeId,
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      fullName: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
      department: data.department ?? "General",
      jobTitle: data.jobTitle ?? "Staff",
      hireDate: data.hireDate ?? "",
      country: (data.country as BHREmployee["country"]) ?? "KSA",
      location: this.normalizeLocation(data.location),
      workEmail: data.workEmail ?? "",
      supervisor: data.supervisor ?? "",
      supervisorId: data.supervisorId ?? "",
      nationality: data.nationality ?? "Unknown",
      iqamaExpiryDate: data.customIqamaExpiryDate || undefined,
      monthlySalary: 0,
      currency: data.currency ?? "SAR",
    };
  }

  // ─── Leave Balance ────────────────────────────────────────────────────────

  async getTimeOffBalance(employeeId: string): Promise<TimeOffBalance[]> {
    const resp = await fetch(
      `${this.baseUrl}/employees/${employeeId}/time_off/calculator`,
      { headers: this.getHeaders() }
    );
    if (!resp.ok) throw new Error(`BambooHR: Could not get leave balance for ${employeeId} (HTTP ${resp.status})`);
    const data = await resp.json() as Array<Record<string, unknown>>;
    return data.map((item) => ({
      leaveType: String(item.name ?? ""),
      balance: Number(item.balance ?? 0),
      used: Number(item.used ?? 0),
      available: Number(item.available ?? 0),
      unit: String(item.units ?? "days"),
    }));
  }

  // ─── Request Time Off ─────────────────────────────────────────────────────

  async requestTimeOff(
    employeeId: string,
    leaveType: string,
    startDate: string,
    endDate: string,
    notes?: string
  ): Promise<TimeOffRequest> {
    const resp = await fetch(
      `${this.baseUrl}/employees/${employeeId}/time_off/request`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ start: startDate, end: endDate, timeOffTypeId: leaveType, note: notes ?? "" }),
      }
    );
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`BambooHR: Failed to submit leave request (HTTP ${resp.status}): ${errText}`);
    }
    const data = await resp.json() as { id: string };
    return { id: data.id, employeeId, leaveType, startDate, endDate, status: "pending", notes };
  }

  // ─── Update Leave Status ──────────────────────────────────────────────────

  async updateTimeOffStatus(
    requestId: string,
    status: "approved" | "declined",
    note?: string
  ): Promise<boolean> {
    const resp = await fetch(
      `${this.baseUrl}/time_off/requests/${requestId}/status`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify({ status, note: note ?? "" }),
      }
    );
    if (!resp.ok) throw new Error(`BambooHR: Failed to update leave request ${requestId} (HTTP ${resp.status})`);
    return true;
  }

  // ─── Create Onboarding Checklist ──────────────────────────────────────────

  async createOnboardingChecklist(employeeId: string, country: string): Promise<OnboardingChecklist> {
    const today = new Date();
    const due = (daysOffset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysOffset);
      return d.toISOString().split("T")[0];
    };

    const baseItems: ChecklistItem[] = [
      { id: "CHK-01", task: "Collect signed employment contract", completed: false, dueDate: due(1), assignedTo: "HR" },
      { id: "CHK-02", task: "Verify Iqama / National ID", completed: false, dueDate: due(1), assignedTo: "HR" },
      { id: "CHK-03", task: "Collect bank account details (IBAN)", completed: false, dueDate: due(3), assignedTo: "Finance" },
      { id: "CHK-04", task: "Collect emergency contact information", completed: false, dueDate: due(3), assignedTo: "HR" },
      { id: "CHK-05", task: "Register in payroll system", completed: false, dueDate: due(7), assignedTo: "Finance" },
      { id: "CHK-06", task: "Set up company email and system access", completed: false, dueDate: due(2), assignedTo: "IT" },
      { id: "CHK-07", task: "Enroll in medical insurance", completed: false, dueDate: due(14), assignedTo: "HR" },
      { id: "CHK-08", task: "Complete Day 1 orientation session", completed: false, dueDate: due(1), assignedTo: "HR" },
    ];

    if (country === "KSA") {
      baseItems.push(
        { id: "CHK-09", task: "Register in GOSI (social insurance)", completed: false, dueDate: due(30), assignedTo: "HR" },
        { id: "CHK-10", task: "Verify Nitaqat / Saudization eligibility", completed: false, dueDate: due(7), assignedTo: "HR" }
      );
    } else if (country === "UAE") {
      baseItems.push(
        { id: "CHK-09", task: "Register in DEWS / DIFC GPSS (if applicable)", completed: false, dueDate: due(30), assignedTo: "HR" }
      );
    }

    const checklistId = `ONBOARD-${employeeId}-${Date.now()}`;

    // Best-effort: try to create a BambooHR custom table task list
    try {
      await fetch(`${this.baseUrl}/employees/${employeeId}/tables/customOnboarding`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          rows: baseItems.map((i) => ({ task: i.task, dueDate: i.dueDate, assignedTo: i.assignedTo })),
        }),
      });
    } catch {
      // Non-fatal: checklist object is still returned regardless
    }

    return { id: checklistId, employeeId, items: baseItems };
  }

  // ─── List all employees (for Iqama scan job) ──────────────────────────────

  async getAllEmployees(): Promise<BHREmployee[]> {
    const resp = await fetch(`${this.baseUrl}/employees/directory`, {
      headers: this.getHeaders(),
    });
    if (!resp.ok) throw new Error(`BambooHR: Could not fetch employee directory (HTTP ${resp.status})`);
    const data = await resp.json() as { employees: Array<Record<string, string>> };
    return data.employees.map((e) => ({
      id: e.id,
      firstName: e.firstName ?? "",
      lastName: e.lastName ?? "",
      fullName: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
      department: e.department ?? "General",
      jobTitle: e.jobTitle ?? "Staff",
      hireDate: e.hireDate ?? "",
      country: (e.country as BHREmployee["country"]) ?? "KSA",
      location: this.normalizeLocation(e.location),
      workEmail: e.workEmail ?? "",
      supervisor: e.supervisor ?? "",
      supervisorId: e.supervisorId ?? "",
      nationality: e.nationality ?? "Unknown",
      iqamaExpiryDate: e.customIqamaExpiryDate || undefined,
      monthlySalary: 0,
      currency: e.currency ?? "SAR",
    }));
  }
}

export const bambooHR = new BambooHRService();

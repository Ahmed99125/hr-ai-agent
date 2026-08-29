import { LuaTool } from "lua-cli";
import { z } from "zod";
import { bambooHR } from "../../../services/BambooHRService.js";

export class IqamaExpiryAlertTool implements LuaTool {
  name = "check_iqama_expiry";
  description =
    "Check an employee's Iqama (إقامة — Saudi residence permit) expiry status. Returns alert level (green/yellow/red), days remaining, and a step-by-step renewal checklist.";

  inputSchema = z.object({
    employeeId: z
      .string()
      .optional()
      .describe("BambooHR employee ID. Provide this OR expiryDate."),
    expiryDate: z
      .string()
      .optional()
      .describe("Direct Iqama expiry date in YYYY-MM-DD format. Provide this if employee ID is not available."),
  }).refine(
    (data) => data.employeeId !== undefined || data.expiryDate !== undefined,
    { message: "Either employeeId or expiryDate must be provided." }
  );

  async execute(input: z.infer<typeof this.inputSchema>) {
    let expiryDateStr: string;
    let employeeName: string | undefined;

    if (input.employeeId) {
      const employee = await bambooHR.getEmployee(input.employeeId);
      if (!employee.iqamaExpiryDate) {
        return {
          status: "no_iqama_data",
          message: `No Iqama expiry date on record for employee ${employee.fullName} (ID: ${input.employeeId}). Please contact HR to update the record.`,
          employeeName: employee.fullName,
        };
      }
      expiryDateStr = employee.iqamaExpiryDate;
      employeeName = employee.fullName;
    } else {
      expiryDateStr = input.expiryDate!;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let alertLevel: "green" | "yellow" | "red" | "expired";
    let alertEmoji: string;
    let urgency: string;

    if (daysRemaining < 0) {
      alertLevel = "expired";
      alertEmoji = "🚨";
      urgency = "EXPIRED — Immediate action required. Contact HR today.";
    } else if (daysRemaining < 30) {
      alertLevel = "red";
      alertEmoji = "🔴";
      urgency = "CRITICAL — Iqama expires in less than 30 days. Begin renewal immediately.";
    } else if (daysRemaining <= 60) {
      alertLevel = "yellow";
      alertEmoji = "🟡";
      urgency = "WARNING — Iqama expires in 30–60 days. Start the renewal process now.";
    } else {
      alertLevel = "green";
      alertEmoji = "🟢";
      urgency = "No immediate action required.";
    }

    const renewalChecklist = this.getRenewalChecklist(daysRemaining);

    return {
      ...(employeeName ? { employeeName } : {}),
      iqamaExpiryDate: expiryDateStr,
      daysRemaining,
      alertLevel,
      alertEmoji,
      urgency,
      renewalChecklist,
      estimatedRenewalFees: {
        governmentFee: "SAR 650 (varies by nationality)",
        medicalTestFee: "SAR 150–300",
        photoFee: "SAR 10–20",
        totalApproximate: "SAR 850–1,000",
        note: "Fees are approximate and may vary. HR can provide exact current fees.",
      },
      importantReminders: [
        "Do not travel abroad when Iqama is within 30 days of expiry.",
        "Ensure your passport is valid for at least 6 months beyond the Iqama renewal date.",
        "Register on Absher (أبشر) to track your Iqama status digitally.",
        "Your employer (Company PRO) must process the renewal on your behalf in most cases.",
      ],
    };
  }

  private getRenewalChecklist(daysRemaining: number): string[] {
    const checklist = [
      "✅ Confirm passport validity (must be valid for at least 6 months from renewal date)",
      "✅ Obtain a medical fitness certificate from an approved MHRSD clinic",
      "✅ Provide a recent passport-size photograph (white background)",
      "✅ Provide a copy of your current Iqama (front and back)",
      "✅ Ensure your GOSI contributions are up to date (employer responsibility)",
      "✅ Register or verify your fingerprints at the nearest passport office (Jawazat — الجوازات)",
      "✅ Ensure your employer has no outstanding Nitaqat violations (red band employers cannot renew Iqamas)",
      "✅ Obtain medical insurance certificate (required for KSA Iqama renewal)",
      "✅ Pay government renewal fee (can be done via Absher platform)",
    ];

    if (daysRemaining < 30) {
      checklist.unshift("🚨 URGENT: Contact your Company PRO immediately — rush processing required.");
    }

    return checklist;
  }
}

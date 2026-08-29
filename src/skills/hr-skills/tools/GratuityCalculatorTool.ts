import { LuaTool } from "lua-cli";
import { z } from "zod";
import {
  calculateGratuity,
  type Country,
  type TerminationType,
} from "../../../services/LaborLawEngine.js";

export class GratuityCalculatorTool implements LuaTool {
  name = "calculate_gratuity";
  description =
    "Calculate end-of-service gratuity (مكافأة نهاية الخدمة) for an employee based on country, monthly salary, years of service, and termination type. Supports KSA (Art. 84/85), UAE, Egypt, and Jordan.";

  inputSchema = z.object({
    country: z
      .enum(["KSA", "UAE", "EGY", "JOR"])
      .describe("Country of employment: KSA (Saudi Arabia), UAE, EGY (Egypt), or JOR (Jordan)"),
    monthlySalary: z
      .number()
      .positive()
      .describe("Employee's basic monthly salary in the local currency (SAR/AED/EGP/JOD). Do NOT include housing or transport allowances."),
    yearsOfService: z
      .number()
      .min(0)
      .describe("Total completed years of service (e.g. 6.5 for 6 years and 6 months)"),
    terminationType: z
      .enum(["termination", "resignation", "contract_end", "mutual_agreement", "retirement"])
      .describe("How the employment ends: termination (by employer), resignation (by employee), contract_end, mutual_agreement, or retirement"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const result = calculateGratuity(
      input.country as Country,
      input.monthlySalary,
      input.yearsOfService,
      input.terminationType as TerminationType
    );

    const currencySymbols: Record<string, string> = {
      SAR: "SAR",
      AED: "AED",
      EGP: "EGP",
      JOD: "JOD",
    };

    const currency = currencySymbols[result.currency] ?? result.currency;

    return {
      country: result.country,
      terminationType: result.terminationType,
      yearsOfService: result.yearsOfService,
      monthlySalary: `${result.monthlySalary.toLocaleString()} ${currency}`,
      totalGratuity: `${result.totalAmount.toLocaleString()} ${currency}`,
      totalGratuityNumeric: result.totalAmount,
      currency: result.currency,
      breakdown: result.breakdown.map((tier: { label: string; rate: string; amount: number }) => ({
        description: tier.label,
        rate: tier.rate,
        amount: `${tier.amount.toLocaleString()} ${currency}`,
      })),
      legalReference: result.statute,
      importantNotes: result.notes,
    };
  }
}

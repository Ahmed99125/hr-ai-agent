import { LuaTool } from "lua-cli";
import { z } from "zod";
import { bambooHR } from "../../../services/BambooHRService.js";

export class EmployeeLookupTool implements LuaTool {
  name = "lookup_employee";
  description =
    "Look up an employee's profile from BambooHR by their employee ID. Returns name, department, job title, hire date, location, and manager.";

  inputSchema = z.object({
    employeeId: z
      .string()
      .describe("The BambooHR employee ID (e.g. '1001'). Demo IDs: 1001, 1002, 1003, 1004, 1005, NEW01"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const employee = await bambooHR.getEmployee(input.employeeId);

    // Calculate tenure
    const hireDate = new Date(employee.hireDate);
    const today = new Date();
    const tenureMs = today.getTime() - hireDate.getTime();
    const tenureYears = Math.floor(tenureMs / (1000 * 60 * 60 * 24 * 365.25));
    const tenureMonths = Math.floor((tenureMs / (1000 * 60 * 60 * 24 * 365.25 * 12)) % 12);

    const locationLabels: Record<string, string> = {
      riyadh_hq: "Riyadh HQ (Saudi Arabia)",
      dubai_plant: "Dubai Plant (UAE)",
      alexandria_hub: "Alexandria Hub (Egypt)",
      amman_center: "Amman Center (Jordan)",
    };

    return {
      employeeId: employee.id,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle,
      department: employee.department,
      entity: employee.country,
      location: locationLabels[employee.location] ?? employee.location,
      hireDate: employee.hireDate,
      tenure: `${tenureYears} year(s) and ${tenureMonths} month(s)`,
      manager: employee.supervisor,
      workEmail: employee.workEmail,
      nationality: employee.nationality,
      ...(employee.iqamaExpiryDate
        ? { iqamaExpiryDate: employee.iqamaExpiryDate }
        : {}),
    };
  }
}

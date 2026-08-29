/**
 * AssignOrientationTool.ts
 *
 * Generates a Day 1–3 orientation schedule tailored to the employee's
 * entity and location. Each entity has its own programs, contacts,
 * and facility-specific sessions.
 */

import { LuaTool } from "lua-cli";
import { z } from "zod";

interface OrientationSession {
  time: string;
  session: string;
  facilitator: string;
  location: string;
  notes?: string;
}

interface DaySchedule {
  day: string;
  date: string;
  theme: string;
  sessions: OrientationSession[];
}

function addDays(days: number): string {
  const d = new Date();
  // Skip Friday/Saturday (UAE/KSA weekend)
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 5 && dow !== 6) added++; // Skip Fri & Sat
  }
  return d.toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const ORIENTATION_PROGRAMS: Record<string, DaySchedule[]> = {
  riyadh_hq: [
    {
      day: "Day 1",
      date: addDays(0),
      theme: "🎉 Welcome & Company Overview",
      sessions: [
        { time: "08:30 – 09:00", session: "Registration & ID Badge Collection", facilitator: "HR Reception", location: "Main Lobby, Ground Floor" },
        { time: "09:00 – 10:30", session: "Welcome Briefing & Company History", facilitator: "Chief HR Officer", location: "Executive Boardroom, 3F" },
        { time: "10:30 – 11:00", session: "Coffee Break & Networking", facilitator: "—", location: "HR Common Area" },
        { time: "11:00 – 12:30", session: "Organizational Structure & Departments", facilitator: "HR Team", location: "Training Room A, 2F" },
        { time: "12:30 – 13:30", session: "Lunch (with department team)", facilitator: "Line Manager", location: "Employee Cafeteria, 1F" },
        { time: "13:30 – 15:00", session: "IT Setup: Laptop, Email, VPN, Systems Access", facilitator: "IT Support", location: "IT Room, 4F", notes: "Bring your Saudi ID / Iqama for IT registration" },
        { time: "15:00 – 16:00", session: "HR Policies: Leave, Benefits & Code of Conduct", facilitator: "HR Specialist", location: "Training Room A, 2F" },
        { time: "16:00 – 16:30", session: "Meet Your Team & Office Tour", facilitator: "Line Manager", location: "Your Department Floor" },
      ],
    },
    {
      day: "Day 2",
      date: addDays(1),
      theme: "📋 Compliance & Statutory Requirements",
      sessions: [
        { time: "09:00 – 10:00", session: "Saudi Labor Law Overview & Employee Rights", facilitator: "HR Legal Advisor", location: "Training Room B, 2F" },
        { time: "10:00 – 11:00", session: "Iqama & GOSI Registration (for expats)", facilitator: "PRO / Government Relations", location: "HR Office, 2F", notes: "Bring original passport and Iqama copy" },
        { time: "11:00 – 12:00", session: "Nitaqat & Saudization Briefing", facilitator: "Compliance Officer", location: "Training Room B, 2F" },
        { time: "12:00 – 13:00", session: "Lunch Break", facilitator: "—", location: "Employee Cafeteria" },
        { time: "13:00 – 14:30", session: "Medical Insurance Enrollment", facilitator: "Insurance Coordinator", location: "HR Office, 2F", notes: "Bring copies of dependent documents if applicable" },
        { time: "14:30 – 15:30", session: "Payroll & IBAN Registration", facilitator: "Finance / Payroll", location: "Finance Department, 5F" },
        { time: "15:30 – 16:30", session: "Health, Safety & Emergency Procedures", facilitator: "HSE Officer", location: "Conference Room C" },
      ],
    },
    {
      day: "Day 3",
      date: addDays(2),
      theme: "🚀 Role Deep-Dive & 30/60/90-Day Goals",
      sessions: [
        { time: "09:00 – 10:30", session: "Role-Specific Handover & Objectives", facilitator: "Line Manager", location: "Department Workspace" },
        { time: "10:30 – 12:00", session: "Key Systems & Tools Training", facilitator: "IT & Team Lead", location: "Department Workspace" },
        { time: "12:00 – 13:00", session: "Lunch with Department Team", facilitator: "—", location: "Employee Cafeteria" },
        { time: "13:00 – 14:30", session: "30-Day Probation Goals Setting", facilitator: "Line Manager & HR", location: "Manager's Office" },
        { time: "14:30 – 15:30", session: "Introduction to Performance Review Process", facilitator: "HR", location: "Training Room A" },
        { time: "15:30 – 16:00", session: "Q&A Open Session & Wrap-Up", facilitator: "HR + Manager", location: "Training Room A" },
      ],
    },
  ],

  dubai_plant: [
    {
      day: "Day 1",
      date: addDays(0),
      theme: "🎉 Welcome & Safety Induction",
      sessions: [
        { time: "07:00 – 07:30", session: "Site Security Check-In & ID Badge", facilitator: "Security Desk", location: "Main Gate, Dubai Plant" },
        { time: "07:30 – 09:00", session: "Mandatory Plant Safety & PPE Induction", facilitator: "HSE Manager", location: "Safety Induction Room", notes: "⚠️ No entry to plant floor without safety induction" },
        { time: "09:00 – 10:30", session: "Company & UAE Entity Overview", facilitator: "Plant HR Manager", location: "Plant Conference Room" },
        { time: "10:30 – 12:00", session: "Plant Tour & Department Introduction", facilitator: "Operations Lead", location: "Production Floor" },
        { time: "12:00 – 13:00", session: "Lunch Break", facilitator: "—", location: "Site Cafeteria" },
        { time: "13:00 – 14:30", session: "IT Setup & SAP/Operations Systems", facilitator: "IT Support - Dubai", location: "IT Room, Admin Block" },
        { time: "14:30 – 16:00", session: "UAE Labor Law & MOHRE Registration", facilitator: "PRO Officer", location: "HR Office, Admin Block" },
      ],
    },
    {
      day: "Day 2",
      date: addDays(1),
      theme: "⚙️ Operations, Compliance & Benefits",
      sessions: [
        { time: "07:00 – 08:30", session: "Dubai Trade Zone Compliance Briefing", facilitator: "Compliance Officer", location: "Conference Room" },
        { time: "08:30 – 10:00", session: "DEWS/End-of-Service Benefits Explanation", facilitator: "HR + Finance", location: "HR Office" },
        { time: "10:00 – 11:30", session: "Medical Insurance - DHA Registration (if applicable)", facilitator: "Insurance Coordinator", location: "HR Office" },
        { time: "11:30 – 12:30", session: "Payroll & UAE WPS Registration", facilitator: "Finance", location: "Finance Office" },
        { time: "12:30 – 13:30", session: "Lunch Break", facilitator: "—", location: "Site Cafeteria" },
        { time: "13:30 – 16:00", session: "Shift Patterns, Emergency Drills & Plant Protocols", facilitator: "HSE + Operations", location: "Plant Floor" },
      ],
    },
    {
      day: "Day 3",
      date: addDays(2),
      theme: "🚀 Role Handover & Probation Goals",
      sessions: [
        { time: "07:00 – 09:00", session: "Shift Handover & Role-Specific Training", facilitator: "Line Manager", location: "Department Workspace" },
        { time: "09:00 – 11:00", session: "Key Equipment & Maintenance Systems Training", facilitator: "Technical Lead", location: "Workshop / Lab" },
        { time: "11:00 – 12:00", session: "30-Day Probation Goals Setting", facilitator: "Line Manager", location: "Manager's Office" },
        { time: "12:00 – 13:00", session: "Lunch", facilitator: "—", location: "Site Cafeteria" },
        { time: "13:00 – 14:00", session: "Performance Review Process & KPIs", facilitator: "HR", location: "Conference Room" },
        { time: "14:00 – 14:30", session: "Orientation Wrap-Up & Q&A", facilitator: "Plant HR Manager", location: "Conference Room" },
      ],
    },
  ],

  alexandria_hub: [
    {
      day: "Day 1",
      date: addDays(0),
      theme: "🎉 Welcome & Egyptian Entity Introduction",
      sessions: [
        { time: "09:00 – 10:00", session: "Registration & Welcome Briefing", facilitator: "HR — Egypt", location: "Reception Area" },
        { time: "10:00 – 11:30", session: "Company Overview & Egyptian Operations", facilitator: "Country Manager", location: "Main Conference Room" },
        { time: "11:30 – 12:30", session: "IT Setup & Systems Access", facilitator: "IT Support", location: "IT Room" },
        { time: "12:30 – 13:30", session: "Lunch with Team", facilitator: "—", location: "Canteen" },
        { time: "13:30 – 15:00", session: "Egyptian Labor Law & Rights (Law No. 12)", facilitator: "HR Legal", location: "Training Room" },
        { time: "15:00 – 16:00", session: "Social Insurance (NOSI) Registration", facilitator: "HR", location: "HR Office", notes: "Bring original National ID" },
      ],
    },
    {
      day: "Day 2",
      date: addDays(1),
      theme: "📋 Compliance & Benefits",
      sessions: [
        { time: "09:00 – 10:30", session: "Medical Insurance Enrollment", facilitator: "Insurance Coordinator", location: "HR Office" },
        { time: "10:30 – 12:00", session: "Payroll & Bank Account Registration", facilitator: "Finance", location: "Finance Office" },
        { time: "12:00 – 13:00", session: "Lunch", facilitator: "—", location: "Canteen" },
        { time: "13:00 – 14:30", session: "Code of Conduct, Data Privacy & Safety", facilitator: "Compliance + HSE", location: "Training Room" },
        { time: "14:30 – 16:00", session: "Department Tour & Introduction to Systems", facilitator: "Line Manager", location: "Department Area" },
      ],
    },
    {
      day: "Day 3",
      date: addDays(2),
      theme: "🚀 Role Handover & Goals Setting",
      sessions: [
        { time: "09:00 – 12:00", session: "Role-Specific Handover & Training", facilitator: "Line Manager + Team Lead", location: "Workspace" },
        { time: "12:00 – 13:00", session: "Lunch", facilitator: "—", location: "Canteen" },
        { time: "13:00 – 14:00", session: "Probation Period & 30-Day Goals", facilitator: "HR + Manager", location: "Manager's Office" },
        { time: "14:00 – 15:00", session: "Performance Management Process", facilitator: "HR", location: "Training Room" },
        { time: "15:00 – 15:30", session: "Wrap-Up & Open Q&A", facilitator: "HR", location: "Training Room" },
      ],
    },
  ],

  amman_center: [
    {
      day: "Day 1",
      date: addDays(0),
      theme: "🎉 Welcome & Jordanian Entity Introduction",
      sessions: [
        { time: "09:00 – 10:00", session: "Registration & ID Badge", facilitator: "HR — Jordan", location: "Reception" },
        { time: "10:00 – 11:30", session: "Company Overview & Jordanian Operations", facilitator: "Country Manager", location: "Board Room" },
        { time: "11:30 – 12:30", session: "IT Setup & Email/Systems Access", facilitator: "IT Support", location: "IT Office" },
        { time: "12:30 – 13:30", session: "Lunch with Team", facilitator: "—", location: "Cafeteria" },
        { time: "13:30 – 15:00", session: "Jordan Labor Law Overview (Law No. 8)", facilitator: "HR", location: "Training Room" },
        { time: "15:00 – 16:00", session: "SSC (Social Security Corporation) Registration", facilitator: "HR", location: "HR Office", notes: "Bring National ID / Passport" },
      ],
    },
    {
      day: "Day 2",
      date: addDays(1),
      theme: "📋 Benefits, Compliance & Safety",
      sessions: [
        { time: "09:00 – 10:30", session: "Medical Insurance Enrollment", facilitator: "Insurance Coordinator", location: "HR Office" },
        { time: "10:30 – 12:00", session: "Payroll & Salary Payment Setup", facilitator: "Finance", location: "Finance Office" },
        { time: "12:00 – 13:00", session: "Lunch", facilitator: "—", location: "Cafeteria" },
        { time: "13:00 – 16:00", session: "Policies, Code of Conduct & Safety Training", facilitator: "HR + Compliance", location: "Training Room" },
      ],
    },
    {
      day: "Day 3",
      date: addDays(2),
      theme: "🚀 Role Handover & Goals",
      sessions: [
        { time: "09:00 – 12:00", session: "Role-Specific Handover & KPIs", facilitator: "Line Manager", location: "Workspace" },
        { time: "12:00 – 13:00", session: "Lunch", facilitator: "—", location: "Cafeteria" },
        { time: "13:00 – 14:00", session: "Probation & 30-Day Goals", facilitator: "HR + Manager", location: "Manager's Office" },
        { time: "14:00 – 15:00", session: "Orientation Wrap-Up & Q&A", facilitator: "HR", location: "Training Room" },
      ],
    },
  ],
};

export class AssignOrientationTool implements LuaTool {
  name = "assign_orientation";
  description =
    "Generate a Day 1–3 orientation schedule for a new employee based on their entity and location. Returns a detailed timetable with sessions, facilitators, locations, and notes tailored to KSA (Riyadh HQ), UAE (Dubai Plant), Egypt (Alexandria Hub), or Jordan (Amman Center).";

  inputSchema = z.object({
    employeeId: z
      .string()
      .describe("BambooHR employee ID of the new joiner"),
    employeeName: z
      .string()
      .describe("Full name of the new employee"),
    location: z
      .enum(["riyadh_hq", "dubai_plant", "alexandria_hub", "amman_center"])
      .describe("Employee's office location — determines the orientation program"),
    startDate: z
      .string()
      .optional()
      .describe("Optional preferred start date for orientation (YYYY-MM-DD). Defaults to today/tomorrow."),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const program = ORIENTATION_PROGRAMS[input.location] ?? ORIENTATION_PROGRAMS.riyadh_hq;

    const locationLabels: Record<string, string> = {
      riyadh_hq: "Riyadh HQ (Saudi Arabia)",
      dubai_plant: "Dubai Plant (UAE)",
      alexandria_hub: "Alexandria Hub (Egypt)",
      amman_center: "Amman Center (Jordan)",
    };

    const workingHours: Record<string, string> = {
      riyadh_hq: "08:00–16:30 (Sun–Thu)",
      dubai_plant: "07:00–16:00 (Mon–Fri, Shift-based)",
      alexandria_hub: "09:00–17:00 (Sun–Thu)",
      amman_center: "09:00–17:00 (Sun–Thu)",
    };

    const totalSessions = program.reduce((sum, day) => sum + day.sessions.length, 0);

    return {
      employeeId: input.employeeId,
      employeeName: input.employeeName,
      location: locationLabels[input.location],
      workingHours: workingHours[input.location],
      totalDays: program.length,
      totalSessions,
      schedule: program,
      importantReminders: [
        "📱 Save the IT Support and HR contact numbers on your phone before Day 1.",
        "🪪 Bring original Iqama / National ID / Passport on Day 1 for registration.",
        "👔 Smart casual attire required. Safety gear mandatory on plant/facility floors.",
        "☕ Light refreshments provided on Day 1. Full meals in the cafeteria from Day 2.",
        "❓ For any questions before your start date, email your HR contact.",
      ],
      message: `✅ A full ${program.length}-day orientation schedule has been prepared for ${input.employeeName} at ${locationLabels[input.location]}. ${totalSessions} sessions have been scheduled across Day 1–${program.length}.`,
    };
  }
}

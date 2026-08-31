import { bambooHR } from "./src/services/BambooHRService.js";
async function main() {
    const employees = await bambooHR.getAllEmployees();
    const emp125 = employees.find(e => e.id === "125");
    console.log("Directory data for 125:", emp125);
}
main().catch(console.error);

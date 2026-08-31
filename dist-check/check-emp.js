import { bambooHR } from "./src/services/BambooHRService.js";
async function main() {
    const emp = await bambooHR.getEmployee("125");
    console.log(emp);
}
main().catch(console.error);

import { bambooHR } from "./src/services/BambooHRService.js";
async function main() {
    const empId = "125";
    const baseUrl = "https://api.bamboohr.com/api/gateway.php/Ahmed99125-hr-ai-agent/v1"; // Using dummy sub or what's in getSubdomain
    // Just use the internal method but it's private.
    // I will just use fetch directly.
    const headers = bambooHR['getHeaders']();
    const resp = await fetch(`https://api.bamboohr.com/api/gateway.php/${bambooHR['getSubdomain']()}/v1/employees/${empId}` +
        `?fields=firstName,lastName,department,jobTitle,hireDate,workEmail,` +
        `supervisorId,supervisor,country,location,nationality,customIqamaExpiryDate,currency`, { headers });
    console.log("Raw JSON:");
    console.log(await resp.json());
}
main().catch(console.error);

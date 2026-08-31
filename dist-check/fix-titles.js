import { bambooHR } from "./src/services/BambooHRService.js";
async function main() {
    const updates = [
        { id: "125", jobTitle: "Team Lead — Operations" },
        { id: "130", jobTitle: "Team Lead — Manufacturing" },
        { id: "134", jobTitle: "Team Lead — Technology" },
        { id: "138", jobTitle: "Team Lead — Customer Success" },
    ];
    for (const u of updates) {
        const resp = await fetch(`https://api.bamboohr.com/api/gateway.php/${bambooHR['getSubdomain']()}/v1/employees/${u.id}`, {
            method: "POST", // BambooHR uses POST for updates to employees
            headers: bambooHR['getHeaders'](),
            body: JSON.stringify({ jobTitle: u.jobTitle })
        });
        console.log(`Updated ${u.id}:`, resp.status, await resp.text());
    }
}
main().catch(console.error);

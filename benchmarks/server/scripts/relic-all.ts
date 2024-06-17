import { ExecException, execSync } from "node:child_process";

const rows = [1, 10, 100, 1000, 10000, 100000];

async function setRows(n: number) {
    const res = await fetch("http://localhost:3000/rows?rows=" + n, {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error("Failed to fetch rows");
    }
}

async function main() {
    for (const row of rows) {
        await setRows(row);
        const command = "k6 run scripts/relic.js";

        try {
            const stdout = execSync(command, {
                stdio: "pipe",
                encoding: "utf8",
            });
            console.log(stdout);
        } catch (err) {
            if ((err as ExecException).stderr) {
                console.error(err);
            }

            console.log((err as ExecException).stdout);
        }
    }
}

main();

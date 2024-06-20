import { ExecException, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rm, rmSync, writeFileSync } from "node:fs";

let rows = [1, 10, 100, 1000, 10000, 100000];
rows = [1, 10, 100, 1000, 10000];

const commands = {
    "initial-pull": "scripts/relic-pull-initial.js",
    "pull 1 change": "-e N_CHANGES=1 scripts/relic-pull.js",
    "pull 10 changes": "-e N_CHANGES=10 scripts/relic-pull.js",
    "pull 100 changes": "-e N_CHANGES=100 scripts/relic-pull.js",
    "create reservation":
        "-e MUTATION_TYPE=createReservation scripts/relic-push.js",
    "delete reservation":
        "-e MUTATION_TYPE=deleteReservation scripts/relic-push.js",
    "update reservation":
        "-e MUTATION_TYPE=updateReservation scripts/relic-push.js",
};

async function setRows(url: string, n: number) {
    const res = await fetch(url + "/rows?rows=" + n, {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error("Failed to fetch rows");
    }
}

async function waitForInflight(url: string) {
    while (true) {
        try {
            const res = await fetch(url + "/wait-for-inflight");
            if (res.ok) {
                break;
            }
            console.error("Failed to wait for inflight requests", res);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
            console.error(err);
        }
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const url = argv[0];
    try {
        rmSync("./results", { recursive: true });
    } catch (err) {}

    for (const row of rows) {
        await setRows(url, row);

        for (const [name, command] of Object.entries(commands)) {
            console.log(`Running ${name} with ${row} rows`);
            let stdout: string;
            try {
                stdout = execSync(`k6 run -e URL=${url} ${command}`, {
                    stdio: "pipe",
                    encoding: "utf8",
                });
            } catch (err) {
                if ((err as ExecException).stderr) {
                    console.error(err);
                }
                stdout = (err as ExecException).stdout as string;
            }
            console.log(row, name, stdout);

            mkdirSync(`./results/${row}/`, { recursive: true });

            const output = readFileSync(`./summary.json`, { encoding: "utf8" });
            rmSync(`./summary.json`);

            writeFileSync(`./results/${row}/${name}.json`, output);

            await waitForInflight(url);
        }
    }
}

main();

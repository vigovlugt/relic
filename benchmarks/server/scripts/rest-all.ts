import { ExecException, execSync } from "node:child_process";
import { mkdirSync, readFileSync, rm, rmSync, writeFileSync } from "node:fs";

let rows = [1, 10, 100, 1000, 10000, 100000];

const commands = {
    reservations: "scripts/rest-reservations.js",
    "create reservation":
        "-e MUTATION_TYPE=createReservation scripts/rest-mutation.js",
    "delete reservation":
        "-e MUTATION_TYPE=deleteReservation scripts/rest-mutation.js",
    "update reservation":
        "-e MUTATION_TYPE=updateReservation scripts/rest-mutation.js",
};

async function setRows(url: string, n: number) {
    const res = await fetch(url + "/rows?rows=" + n, {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error("Failed to fetch rows");
    }
}

async function main() {
    const argv = process.argv.slice(2);
    const url = argv[0];
    try {
        rmSync("./results-rest", { recursive: true });
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

            mkdirSync(`./results-rest/${row}/`, { recursive: true });

            const output = readFileSync(`./summary.json`, { encoding: "utf8" });
            rmSync(`./summary.json`);

            writeFileSync(`./results-rest/${row}/${name}.json`, output);
        }
    }
}

main();

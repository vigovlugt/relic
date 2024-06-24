import { ExecException, execSync } from "node:child_process";
import {
    createReadStream,
    mkdirSync,
    readFileSync,
    rm,
    rmSync,
    writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";

let rows = [1, 10, 100, 1000, 10000, 100000];

const commands = {
    "create reservation":
        "-e MUTATION_TYPE=createReservation scripts/rest-mutation.js",
    "delete reservation":
        "-e MUTATION_TYPE=deleteReservation scripts/rest-mutation.js",
    reservations: "scripts/rest-reservations.js",
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

function readLines(input: any, func: (arg0: string) => void) {
    let resolve: (value: void | PromiseLike<void>) => void;
    const promise = new Promise<void>((res) => {
        resolve = res;
    });

    var remaining = "";

    input.on("data", (data: string) => {
        remaining += data;
        var index = remaining.indexOf("\n");
        while (index > -1) {
            var line = remaining.substring(0, index);
            remaining = remaining.substring(index + 1);
            func(line);
            index = remaining.indexOf("\n");
        }
    });

    input.on("end", () => {
        if (remaining.length > 0) {
            func(remaining);
        }

        resolve();
    });

    return promise;
}

async function parseJsonData() {
    const rawdata = createReadStream("data.json", "utf8");
    const data: any[] = [];
    await readLines(rawdata, (line) => {
        data.push(JSON.parse(line));
    });

    const requests = [];
    for (const row of data) {
        if (row.data.group === "::teardown" || row.data.group === "::setup")
            continue;
        if (isNaN(row.data.value)) continue;

        if (row.metric === "http_req_duration") {
            requests.push(row);
        }
    }

    const avg = requests.reduce((acc, curr) => {
        return acc + curr.data.value / requests.length;
    }, 0);

    const stdev = Math.sqrt(
        requests.reduce((acc, curr) => {
            return acc + Math.pow(curr.data.value - avg, 2) / requests.length;
        }, 0)
    );

    const reqsBySecond = new Map<number, number>();
    for (const row of requests) {
        const time = new Date(row.data.time).getTime();
        const second = Math.floor(time / 1000);

        reqsBySecond.set(second, (reqsBySecond.get(second) ?? 0) + 1);
    }

    const minTime = Math.min(...reqsBySecond.keys());
    const maxTime = Math.max(...reqsBySecond.keys());
    for (let i = minTime; i <= maxTime; i++) {
        if (!reqsBySecond.has(i)) {
            reqsBySecond.set(i, 0);
        }
    }

    const rps = Array.from(reqsBySecond.values());

    const rpsAvg = rps.reduce((acc, curr) => {
        return acc + curr / rps.length;
    }, 0);

    const rpsStdev = Math.sqrt(
        rps.reduce((acc, curr) => {
            return acc + Math.pow(curr - rpsAvg, 2) / rps.length;
        }, 0)
    );

    return {
        latency: { avg, stdev, n: requests.length },
        rps: { avg: rpsAvg, stdev: rpsStdev, n: rps.length },
    };
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
                stdout = execSync(
                    `k6 run --out json=data.json -e URL=${url} ${command}`,
                    {
                        stdio: "pipe",
                        encoding: "utf8",
                    }
                );
            } catch (err) {
                if ((err as ExecException).stderr) {
                    console.error(err);
                }
                stdout = (err as ExecException).stdout as string;
            }
            console.log(row, name, stdout);

            mkdirSync(`./results-rest/${row}/`, { recursive: true });

            const data = await parseJsonData();
            rmSync(`./data.json`);

            writeFileSync(
                `./results-rest/${row}/${name}.json`,
                JSON.stringify(data, null, 4)
            );
        }
    }
}

main();
// parseJsonData().then(console.log).catch(console.error);

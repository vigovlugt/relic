import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import exec from 'k6/execution';

const N_CHANGES = __ENV.N_CHANGES ? parseInt(__ENV.N_CHANGES) : undefined;
if (N_CHANGES === undefined) {
    throw new Error("N_CHANGES must be set");
}

const URL = __ENV.URL
if (!URL) {
    throw new Error("URL is required");
}

export const options = {
    vus: 100,
    duration: "60s",
    setupTimeout: "600s"
};

export function setup() {
    console.log({ N_CHANGES });

    const data = [];
    for (let i = 0; i < exec.instance.vusInitialized; i++) {
        console.log("Setting up user", i);
        const clientId = uuidv4(true);
        const res = http.post(URL + "/relic/pull?user=x", JSON.stringify({
            clientId,
            version: null
        }));
        const version = res.json().data.version;
        data.push({ clientId, version: version })
    }

    const res = http.post(URL + "/changes?changes=" + N_CHANGES)
    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    return data;
}

export default function (data) {
    const myData = data[exec.vu.idInInstance - 1];
    const res = http.post(URL + "/relic/pull?user=x", JSON.stringify(myData), {
        timeout: "600s",
    });
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}

export function teardown() {
    const res = http.del(URL + "/changes");
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data),
    };
}
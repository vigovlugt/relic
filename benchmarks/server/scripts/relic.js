import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import exec from 'k6/execution';

export const options = {
    vus: 100,
    duration: "60s",
};

export function setup() {
    const data = [];
    console.log(exec.instance)
    for (let i = 0; i < exec.instance.vusInitialized; i++) {
        console.log("Setting up user", i);
        const clientId = uuidv4(true);
        const res = http.post("http://localhost:3000/relic/pull?user=x", JSON.stringify({
            clientId,
            version: null
        }));
        const version = res.json().data.version;
        data.push({ clientId, version: version })
    }

    return data;
}

export default function (data) {
    const myData = data[exec.vu.idInInstance - 1];
    const res = http.post("http://localhost:3000/relic/pull?user=x", JSON.stringify(myData));
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}

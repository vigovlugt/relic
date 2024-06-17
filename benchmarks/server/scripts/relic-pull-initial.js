import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import exec from 'k6/execution';

export const options = {
    scenarios: {
        default: {
            executor: 'constant-vus',
            vus: 100,
            duration: "60s",
            gracefulStop: "600s",
        }
    },
};

export default function (data) {
    const clientId = uuidv4();
    const res = http.post("http://localhost:3000/relic/pull?user=x", JSON.stringify({
        clientId,
        version: null
    }), {
        timeout: "600s",
    });
    check(res, {
        'status is 200': (r) => r.status === 200,
    });
}

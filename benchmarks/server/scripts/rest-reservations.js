import http from "k6/http";
import { check, sleep } from "k6";

const URL = __ENV.URL;
if (!URL) {
    throw new Error("URL is required");
}

export const options = {
    vus: 100,
    duration: "60s",
};

export default function () {
    const res = http.get(URL + "/reservations?user=Alice");
    check(res, {
        'status is 200': (r) => res.status === 200,
    });
    // sleep(1)
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data),
    };
}

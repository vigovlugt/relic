import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    // stages: [
    //     { duration: '1m', target: 1000 }, // just slowly ramp-up to a HUGE load
    // ],
    vus: 500,
    duration: "30s",
    // iterations: 10000
};

// export function setup() {
//     return { i: 0 };
// }

export default function () {
    const res = http.get("http://localhost:3000/reservations?user=Alice");
    check(res, {
        'status is 200': (r) => res.status === 200,
    });
    // sleep(1)
}

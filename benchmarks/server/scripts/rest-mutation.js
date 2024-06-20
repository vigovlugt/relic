import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import exec from "k6/execution";

const MUTATION_TYPE = __ENV.MUTATION_TYPE;
if (!["createReservation", "updateReservation", "deleteReservation"].includes(MUTATION_TYPE)) {
    throw new Error("MUTATION_TYPE must be set");
}

const URL = __ENV.URL;
if (!URL) {
    throw new Error("URL is required");
}

export const options = {
    scenarios: {
        default: {
            executor: "constant-vus",
            vus: 100,
            duration: "60s",
            gracefulStop: "600s",
        },
    },
};

export default function () {
    switch (MUTATION_TYPE) {
        case "createReservation": {
            const res = http.post(
                URL + "/reservations?user=Changes",
                JSON.stringify({
                    id: uuidv4(true),
                    start: new Date().toISOString(),
                    end: new Date().toISOString(),
                    roomId: "00000000-0000-0000-0000-000000000000",
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    timeout: "600s",
                }
            );
            console.log(res, "\n");
            check(res, {
                "status is 200": (r) => r.status === 200,
            });
            break;
        }
        case "updateReservation": {
            const res = http.put(
                URL + "/reservations/00000000-0000-0000-0000-000000000000?user=Changes",
                JSON.stringify({
                    id: "00000000-0000-0000-0000-000000000000",
                    start: new Date().toISOString(),
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    timeout: "600s",
                }
            );
            check(res, {
                "status is 200": (r) => r.status === 200,
            });
            break;
        }
        case "deleteReservation": {
            const res = http.del(
                URL + "/reservations/00000000-0000-0000-0000-000000000000?user=Changes",
                JSON.stringify({
                    id: "00000000-0000-0000-0000-000000000000",
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    timeout: "600s",
                }
            );
            check(res, {
                "status is 200": (r) => r.status === 200,
            });
            break;
        }
    }


}

export function teardown() {
    const res = http.del(URL + "/changes");
    check(res, {
        "status is 200": (r) => r.status === 200,
    });
}

export function handleSummary(data) {
    return {
        'summary.json': JSON.stringify(data),
    };
}
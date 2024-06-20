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

export function setup() {
    const data = [];
    for (let i = 0; i < exec.instance.vusInitialized; i++) {
        console.log("Setting up user", i);
        const clientId = uuidv4(true);

        // do createReservation mutation to create RelicClient, reservation is later deleted
        const mutation = {
            id: 1,
            name: "createReservation",
            input: {
                id: uuidv4(true),
                start: new Date().toISOString(),
                end: new Date().toISOString(),
                roomId: "00000000-0000-0000-0000-000000000000",
            },
        };
        const res = http.post(
            URL + "/relic/push?user=Changes",
            JSON.stringify({
                clientId,
                mutations: [mutation],
            }),
            {
                timeout: "600s",
            }
        );
        check(res, {
            "status is 200": (r) => r.status === 200,
        });

        data.push({ clientId });
    }

    return data;
}

export default function (data) {
    const { clientId } = data[exec.vu.idInInstance - 1];

    let mutation;

    switch (MUTATION_TYPE) {
        case "createReservation":
            mutation = {
                id: exec.vu.iterationInInstance + 2,
                name: "createReservation",
                input: {
                    id: uuidv4(true),
                    start: new Date().toISOString(),
                    end: new Date().toISOString(),
                    roomId: "00000000-0000-0000-0000-000000000000",
                },
            };
            break;
        case "updateReservation":
            mutation = {
                id: exec.vu.iterationInInstance + 2,
                name: "updateReservation",
                input: {
                    id: "00000000-0000-0000-0000-000000000000",
                    start: new Date().toISOString(),
                },
            };
            break;
        case "deleteReservation":
            mutation = {
                id: exec.vu.iterationInInstance + 2,
                name: "deleteReservation",
                input: "00000000-0000-0000-0000-000000000000",
            };
            break;
    }


    const res = http.post(
        URL + "/relic/push?user=Changes",
        JSON.stringify({
            clientId,
            mutations: [mutation],
        }),
        {
            timeout: "600s",
        }
    );
    check(res, {
        "status is 200": (r) => r.status === 200,
    });
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
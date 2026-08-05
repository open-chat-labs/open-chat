import { publish, subscribe } from "./pubsub";

describe("pubsub", () => {
    test("publishes the generic on-device models navigation event without a payload", () => {
        let received = 0;
        const unsubscribe = subscribe("userProfileModels", () => {
            received += 1;
        });

        publish("userProfileModels");
        unsubscribe();

        expect(received).toEqual(1);
    });
});

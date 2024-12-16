import { load as botCheck } from "@fingerprintjs/botd";
import { writable } from "svelte/store";

export const suspectedAutomationBot = writable<boolean>(false);

botCheck()
    .then((botd) => botd.detect())
    .then((result) => {
        console.log("Bot detection result: ", result.bot);
        suspectedAutomationBot.set(result.bot);
    })
    .catch((err) => console.error(`Error during bot detection: `, err));

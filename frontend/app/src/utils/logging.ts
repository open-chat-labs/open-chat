import type { Logger } from "openchat-client";
import Rollbar from "rollbar";

const rollbar = Rollbar.init({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    autoInstrument: false,
    logLevel: "error",
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
    captureUnhandledRejections: true,
    payload: {
        environment: process.env.NODE_ENV,
        client: {
            javascript: {
                source_map_enabled: true,
                code_version: process.env.OPENCHAT_WEBSITE_VERSION,
                guess_uncaught_frames: true,
            },
        },
    },
});

export function debug<T>(data: T, msg?: string): T {
    if (msg) {
        console.log(msg, data);
    } else {
        console.log(data);
    }
    return data;
}

export const logger: Logger = {
    error(message?: unknown, ...optionalParams: unknown[]): void {
        console.error(message as string, optionalParams);
        rollbar.error(message as string, optionalParams);
    },
};

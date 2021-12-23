import Rollbar from "rollbar";

export const rollbar = Rollbar.init({
    accessToken: "process.env.ROLLBAR_ACCESS_TOKEN",
    captureUncaught: true,
    autoInstrument: false,
    logLevel: "error",
    environment: process.env.NODE_ENV,
    captureUnhandledRejections: true,
});

export function debug<T>(data: T, msg?: string): T {
    if (msg) {
        console.log(msg, data);
    } else {
        console.log(data);
    }
    return data;
}

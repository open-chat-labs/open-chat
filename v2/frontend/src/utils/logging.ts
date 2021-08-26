import Rollbar from "rollbar";

export const rollbar = Rollbar.init({
    accessToken: "process.env.ROLLBAR_ACCESS_TOKEN",
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
        environment: "process.env.NODE_ENV",
    },
});

export function debug<T>(msg: T): T {
    console.log(msg);
    return msg;
}

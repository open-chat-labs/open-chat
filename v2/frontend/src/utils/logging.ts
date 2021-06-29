import Rollbar from "rollbar";

export const rollbar = Rollbar.init({
    accessToken: "3194bdfb0c064240911a79b287765413",
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
        environment: process.env.NODE_ENV,
    },
});

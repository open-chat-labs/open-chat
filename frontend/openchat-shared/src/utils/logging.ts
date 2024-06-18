export type Logger = {
    error(message: unknown, error: unknown, ...optionalParams: unknown[]): void;
    log(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
};

import Rollbar, { type LogArgument } from "rollbar";
import { offline } from "./network";

let rollbar: Rollbar | undefined;

export function inititaliseLogger(apikey: string, version: string, env: string): Logger {
    if (env === "production") {
        rollbar = Rollbar.init({
            accessToken: apikey,
            captureUncaught: true,
            autoInstrument: false,
            logLevel: "error",
            environment: env,
            enabled: env === "production",
            captureUnhandledRejections: true,
            payload: {
                environment: env,
                client: {
                    javascript: {
                        source_map_enabled: true,
                        code_version: version,
                        guess_uncaught_frames: true,
                    },
                },
            },
        });
    }
    return {
        error(message: unknown, error: unknown, ...optionalParams: unknown[]): void {
            console.error(message as string, error, optionalParams);
            if (!offline()) {
                rollbar?.error(error as LogArgument, message as LogArgument, optionalParams);
            }
        },
        log(message?: unknown, ...optionalParams: unknown[]): void {
            console.log(message as string, optionalParams);
        },
        debug(message?: unknown, ...optionalParams: unknown[]): void {
            console.debug(message as string, optionalParams);
        },
    };
}

export function debug<T>(data: T, msg?: string): T {
    if (msg) {
        console.log(msg, data);
    } else {
        console.log(data);
    }
    return data;
}

export function logDuration(msg: string, started: number): void {
    console.debug(`PERF: ${msg}`, Date.now() - started);
}

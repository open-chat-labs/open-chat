export type Logger = {
    error(message: unknown, error: unknown, ...optionalParams: unknown[]): void;
    log(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
};

import Rollbar, { type LogArgument } from "rollbar";
import { offline } from "./network";
import { NOOP } from "../constants";
import type { LogLevel } from "../domain/logging";
import { shouldReportError, shouldReportMessage } from "./error";

let rollbar: Rollbar | undefined;

// Pull the strings Rollbar would fingerprint on out of a payload: the exception class/message of
// the primary error for trace items, the body for plain message items. Only the primary error is
// inspected - `trace_chain[0]`, with any causes following it - because a real failure wrapped
// around an expected cause is still a real failure and must be reported.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rollbarPayloadError(payload: any): { name: string; message: string } {
    const body = payload?.body;
    const exception = (body?.trace_chain?.[0] ?? body?.trace)?.exception;
    if (exception != null) {
        return {
            name: typeof exception.class === "string" ? exception.class : "",
            message: typeof exception.message === "string" ? exception.message : "",
        };
    }
    return {
        name: "",
        message: typeof body?.message?.body === "string" ? body.message.body : "",
    };
}

// Rollbar hands `checkIgnore` the original arguments alongside the payload, and for an unhandled
// rejection those include the rejection reason itself. That matters for anything thrown in the
// worker: it crosses the boundary as JSON, so the reason arrives as a plain object rather than an
// Error, Rollbar cannot read an exception class off it and files the item as "(unknown): message"
// with no class at all. `name` and `code` are exactly what most of `shouldReportError`'s rules
// are keyed on - session expiry, the 502-504 range, retry-exhausted - so reading them off the
// payload alone silently loses every one of those. Recover the reason and filter on that.
// Exported for testing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function uncaughtReason(args: any): unknown {
    if (!Array.isArray(args)) return undefined;
    return args.find(
        (arg) =>
            arg != null &&
            typeof arg === "object" &&
            (typeof arg.name === "string" || typeof arg.message === "string"),
    );
}

// True when the innermost frame of the primary error is browser-extension code: the error was
// thrown by an extension (CSP violations from injected wasm, wallet inpage scripts, ...), not us.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function thrownByExtension(payload: any): boolean {
    const body = payload?.body;
    const frames = (body?.trace_chain?.[0] ?? body?.trace)?.frames;
    if (!Array.isArray(frames) || frames.length === 0) return false;
    // Rollbar frames are ordered outermost first, so the throw site is last
    const filename = frames[frames.length - 1]?.filename;
    return typeof filename === "string" && /^(chrome|moz|safari-web)-extension:\/\//.test(filename);
}

// Rollbar matches an uploaded source map to a stack frame by exact minified URL. The same bundle
// is served from four origins - oc.app, webtest.oc.app, the canister's own .icp0.io domain, and
// http://tauri.localhost in the native app - and the workers are loaded with a `?v=` cache
// buster, so a frame's filename is one of many strings for the same file. `dynamichost` is
// Rollbar's placeholder host for exactly this: rewrite every frame to it and one uploaded map
// covers all four. `scripts/upload-source-maps.mjs` registers the same URLs.
// Frames that are not http(s) are left alone - `thrownByExtension` identifies extension code by
// the `chrome-extension://` prefix, and rewriting those would break that check.
const DYNAMIC_HOST = "http://dynamichost";

function normaliseFrameFilename(filename: unknown): string | undefined {
    if (typeof filename !== "string" || !/^https?:\/\//i.test(filename)) return undefined;
    try {
        // pathname only: drops the origin and the `?v=` query, keeping any directory prefix so
        // the URL still matches the map's path relative to the build directory
        return `${DYNAMIC_HOST}${new URL(filename).pathname}`;
    } catch {
        return undefined;
    }
}

// Exported for testing: a mismatch between this and the URLs `upload-source-maps.mjs` registers
// fails silently, with traces simply staying minified.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normaliseSourceMapUrls(payload: any): void {
    const body = payload?.body;
    const traces = body?.trace_chain ?? (body?.trace != null ? [body.trace] : []);
    if (!Array.isArray(traces)) return;
    for (const trace of traces) {
        const frames = trace?.frames;
        if (!Array.isArray(frames)) continue;
        for (const frame of frames) {
            const normalised = normaliseFrameFilename(frame?.filename);
            if (normalised !== undefined) {
                frame.filename = normalised;
            }
        }
    }
}

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
            // Noise with no fix on our side: opaque cross-origin "Script error." (injected
            // scripts, extensions), and Chrome extension messaging failures
            ignoredMessages: [
                "Script error.",
                "Could not establish connection. Receiving end does not exist.",
            ],
            // captureUncaught / captureUnhandledRejections bypass our logger, so uncaught
            // items get the same noise filtering at the transport layer. Logger-reported items
            // (isUncaught false) already passed shouldReportError and are not re-filtered here.
            checkIgnore: (isUncaught, args, payload) => {
                if (!isUncaught) return false;
                if (thrownByExtension(payload)) return true;
                // Prefer the reason itself: it still carries name and code, which the payload
                // does not for anything that crossed the worker boundary
                const reason = uncaughtReason(args);
                if (reason !== undefined) return !shouldReportError(reason);
                const { name, message } = rollbarPayloadError(payload);
                return !shouldReportMessage(name, message);
            },
            transform: (payload) => normaliseSourceMapUrls(payload),
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
            if (!shouldReportError(error)) {
                console.debug("Expected failure (not reported): ", message, error);
                return;
            }

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

const DEFAULT_DEBUG = console.debug;
const DEFAULT_LOG = console.log;
const DEFAULT_WARN = console.warn;

export function setMinLogLevel(level: LogLevel) {
    const levelAsInt = level === "debug" ? 0 : level === "log" ? 1 : level === "warn" ? 2 : 3;
    const debugEnabled = levelAsInt <= 0;
    const logEnabled = levelAsInt <= 1;
    const warnEnabled = levelAsInt <= 2;

    console.debug = debugEnabled ? DEFAULT_DEBUG : NOOP;
    console.log = logEnabled ? DEFAULT_LOG : NOOP;
    console.warn = warnEnabled ? DEFAULT_WARN : NOOP;
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

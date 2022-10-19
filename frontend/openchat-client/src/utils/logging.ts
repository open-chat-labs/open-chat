// FIXME - this is just temporary to prevent a flood of compilation errors
export const rollbar = {
    debug(message?: unknown, ...optionalParams: unknown[]): void {
        console.debug(message, optionalParams);
    },
    warn(message?: unknown, ...optionalParams: unknown[]): void {
        console.warn(message, optionalParams);
    },
    log(message?: unknown, ...optionalParams: unknown[]): void {
        console.log(message, optionalParams);
    },
    error(message?: unknown, ...optionalParams: unknown[]): void {
        console.error(message, optionalParams);
    },
};

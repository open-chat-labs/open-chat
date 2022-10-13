// FIXME - this is just temporary to prevent a flood of compilation errors
export const rollbar = {
    debug(message?: any, ...optionalParams: any[]): void {
        console.debug(message, optionalParams);
    },
    warn(message?: any, ...optionalParams: any[]): void {
        console.warn(message, optionalParams);
    },
    log(message?: any, ...optionalParams: any[]): void {
        console.log(message, optionalParams);
    },
    error(message?: any, ...optionalParams: any[]): void {
        console.error(message, optionalParams);
    },
};

declare type Logger = {
    debug: (...args: [...unknown[]]) => void;
    log: (...args: [...unknown[]]) => void;
    warn: (...args: [...unknown[]]) => void;
    error: (...args: [...unknown[]]) => void;
    groupCollapsed: () => void;
    groupEnd: () => void;
};
declare const logger: Logger;
export { logger };

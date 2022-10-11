const nullLogger = {
    debug: () => { },
    log: () => { },
    warn: () => { },
    error: () => { },
    groupCollapsed: () => { },
    groupEnd: () => { },
};
const logger = process.env.NODE_ENV === "production"
    ? nullLogger
    : (() => {
        let inGroup = false;
        const methodToColorMap = {
            debug: `#7f8c8d`,
            log: `#2ecc71`,
            warn: `#f39c12`,
            error: `#c0392b`,
            groupCollapsed: `#3498db`,
            groupEnd: null, // No colored prefix on groupEnd
        };
        const print = function (method, args) {
            if (method === "groupCollapsed") {
                // Safari doesn't print all console.groupCollapsed() arguments:
                // https://bugs.webkit.org/show_bug.cgi?id=182754
                if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
                    console[method](...args);
                    return;
                }
            }
            const styles = [
                `background: ${methodToColorMap[method]}`,
                `border-radius: 0.5em`,
                `color: white`,
                `font-weight: bold`,
                `padding: 2px 0.5em`,
            ];
            // When in a group, the workbox prefix is not displayed.
            const logPrefix = inGroup ? [] : ["%cworkbox", styles.join(";")];
            console[method](...logPrefix, ...args);
            if (method === "groupCollapsed") {
                inGroup = true;
            }
            if (method === "groupEnd") {
                inGroup = false;
            }
        };
        return {
            debug: (...args) => print("debug", args),
            log: (...args) => print("log", args),
            warn: (...args) => print("warn", args),
            error: (...args) => print("error", args),
            groupCollapsed: () => print("groupCollapsed", []),
            groupEnd: () => print("groupEnd", []),
        };
    })();
export { logger };
//# sourceMappingURL=logger.js.map
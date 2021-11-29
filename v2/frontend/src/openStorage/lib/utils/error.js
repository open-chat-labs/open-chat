export class UnsupportedValueError extends Error {
    constructor(msg, value) {
        super(`${msg}: ${value}`);
    }
}
//# sourceMappingURL=error.js.map
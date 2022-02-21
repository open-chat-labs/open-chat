export class UnsupportedValueError extends Error {
    constructor(msg: string, value: never) {
        super(`${msg}: ${value}`);
    }
}

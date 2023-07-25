export class UnsupportedValueError extends Error {
    constructor(msg: string, value: never) {
        super(`${msg}: ${value}`);
    }
}

export class HttpError extends Error {
    constructor(public code: number, error: Error) {
        super(error.message);
        this.stack = error.stack;
        this.name = "HttpError";
    }
}

export class AuthError extends HttpError {
    constructor(public code: number, error: Error) {
        super(code, error);
        this.name = "AuthError";
    }
}

export class SessionExpiryError extends HttpError {
    constructor(public code: number, error: Error) {
        super(code, error);
        this.name = "SessionExpiryError";
    }
}

export class DestinationInvalidError extends HttpError {
    constructor(error: Error) {
        super(404, error);
        this.name = "DestinationInvalidError";
    }
}

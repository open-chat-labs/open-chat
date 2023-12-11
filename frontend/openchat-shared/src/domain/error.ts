export class UnsupportedValueError extends Error {
    constructor(msg: string, value: never) {
        super(`${msg}: ${value}`);
    }
}

export class HttpError extends Error {
    constructor(
        public code: number,
        error: Error,
    ) {
        super(error.message);
        this.stack = error.stack;
        this.name = "HttpError";
    }
}

export class AuthError extends HttpError {
    constructor(
        public code: number,
        error: Error,
    ) {
        super(code, error);
        this.name = "AuthError";
    }
}

export class SessionExpiryError extends HttpError {
    constructor(
        public code: number,
        error: Error,
    ) {
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

export class InvalidDelegationError extends HttpError {
    constructor(error: Error) {
        super(403, error);
        this.name = "InvalidDelegationError";
    }
}

// We'll use this is the front end tries to do something that the anonymous user should not be able to do
export class AnonymousOperationError extends Error {}

export declare class HttpError extends Error {
    code: number;
    constructor(code: number, error: Error);
}
export declare class AuthError extends HttpError {
    code: number;
    constructor(code: number, error: Error);
}
export declare function toHttpError(error: Error): HttpError;

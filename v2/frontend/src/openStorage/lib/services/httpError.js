export class HttpError extends Error {
    constructor(code, error) {
        super(error.message);
        this.code = code;
        this.stack = error.stack;
        this.name = "HttpError";
    }
}
export class AuthError extends HttpError {
    constructor(code, error) {
        super(code, error);
        this.code = code;
        this.name = "AuthError";
    }
}
export function toHttpError(error) {
    let code = 500;
    const statusLine = error.message
        .split("\n")
        .map((l) => l.trim().toLowerCase())
        .find((l) => l.startsWith("code:") || l.startsWith("http status code:"));
    if (statusLine) {
        const parts = statusLine.split(":");
        if (parts && parts.length > 1) {
            let valueText = parts[1].trim();
            const valueParts = valueText.split(" ");
            if (valueParts && valueParts.length > 1) {
                valueText = valueParts[0].trim();
            }
            code = parseInt(valueText, 10);
            if (isNaN(code)) {
                code = 500;
            }
        }
    }
    return code === 401 || code === 403 ? new AuthError(code, error) : new HttpError(code, error);
}
//# sourceMappingURL=httpError.js.map
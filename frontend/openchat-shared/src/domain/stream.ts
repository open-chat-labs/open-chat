type OnStreamResult<T> = (result: T, final: boolean) => void;
type OnStreamError = (reason?: unknown) => void;
type OnStreamEnd = () => void;

/**
 * This class offers a Promise-like interface but replaces `then` with `subscribe`.
 * The function passed into subscribe will then be called each time new data is available.
 * The onResult fn will also be given a `final` param in case the calling code needs to know
 * if the final chunk of data has been received.
 */
export class Stream<T> {
    private onResult?: OnStreamResult<T>;
    private onError?: OnStreamError;
    private onEnd?: OnStreamEnd;

    constructor(
        initialiser: (
            resolve: (val: T, final: boolean) => void,
            reject: (reason?: unknown) => void,
        ) => void,
    ) {
        initialiser(
            (val: T, final: boolean) => {
                if (this.onResult) {
                    this.onResult(val, final);
                }
                if (final && this.onEnd) {
                    this.onEnd();
                }
            },
            (reason?: unknown) => {
                if (this.onError) {
                    this.onError(reason);
                }
            },
        );
    }

    subscribe(onResult: OnStreamResult<T>): Stream<T> {
        const existing = this.onResult;
        if (existing === undefined) {
            this.onResult = onResult;
        } else {
            this.onResult = (value, final) => {
                existing(value, final);
                onResult(value, final);
            };
        }
        return this;
    }

    catch(onError: OnStreamError): Stream<T> {
        const existing = this.onError;
        if (existing === undefined) {
            this.onError = onError;
        } else {
            this.onError = (reason) => {
                existing(reason);
                onError(reason);
            };
        }
        return this;
    }

    finally(onEnd: OnStreamEnd): Stream<T> {
        const existing = this.onEnd;
        if (existing === undefined) {
            this.onEnd = onEnd;
        } else {
            this.onEnd = () => {
                existing();
                onEnd();
            };
        }
        return this;
    }
}

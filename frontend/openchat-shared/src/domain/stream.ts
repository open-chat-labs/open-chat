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
    private onResult: OnStreamResult<T>[] = [];
    private onError: OnStreamError[] = [];
    private onEnd: OnStreamEnd[] = [];

    constructor(
        initialiser: (
            resolve: (val: T, final: boolean) => void,
            reject: (reason?: unknown) => void,
        ) => void,
    ) {
        initialiser(
            (val: T, final: boolean) => {
                this.onResult.forEach((f) => f(val, final));
                if (final) {
                    this.onEnd.forEach((f) => f());
                }
            },
            (reason?: unknown) => {
                this.onError.forEach((f) => f(reason));
            },
        );
    }

    subscribe(onResult: OnStreamResult<T>): Stream<T> {
        this.onResult.push(onResult);
        return this;
    }

    catch(onError: OnStreamError): Stream<T> {
        this.onError.push(onError);
        return this;
    }

    finally(onEnd: OnStreamEnd): Stream<T> {
        this.onEnd.push(onEnd);
        return this;
    }
}

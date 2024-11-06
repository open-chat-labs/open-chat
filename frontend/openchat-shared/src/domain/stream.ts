type OnStreamResult<T> = (result: T, final: boolean) => void;
type OnStreamError = (reason?: unknown) => void;
type OnStreamEnd = () => void;

type Subscription<T> = {
    onResult: OnStreamResult<T>;
    onError?: OnStreamError;
    onEnd?: OnStreamEnd;
};

/**
 * This class offers a Promise-like interface but replaces `then` with `subscribe`.
 * The function passed into subscribe will then be called each time new data is available.
 * The onResult fn will also be given a `final` param in case the calling code needs to know
 * if the final chunk of data has been received.
 */
export class Stream<T> {
    private subscribed = false;
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

    subscribe(subscription: Subscription<T>) {
        if (this.subscribed) {
            throw new Error("Already subscribed");
        }
        this.subscribed = true;
        this.onResult = subscription.onResult;
        this.onError = subscription.onError;
        this.onEnd = subscription.onEnd;
    }
}

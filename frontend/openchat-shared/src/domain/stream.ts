type OnStreamResult<T> = (result: T, final: boolean) => void;
type OnStreamError = (reason?: unknown) => void;
type OnStreamEnd = () => void;

type Subscription<T> = {
    onResult?: OnStreamResult<T>;
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
    private subscriptions: Subscription<T>[] = [];

    constructor(
        initialiser: (
            resolve: (val: T, final: boolean) => void,
            reject: (reason?: unknown) => void,
        ) => void,
    ) {
        initialiser(
            (val: T, final: boolean) => {
                this.subscriptions.forEach((s) => {
                    if (s.onResult) {
                        s.onResult(val, final);
                    }
                    if (final && s.onEnd) {
                        s.onEnd();
                    }
                });
            },
            (reason?: unknown) => {
                this.subscriptions.forEach((s) => {
                    if (s.onError) {
                        s.onError(reason);
                    }
                });
            },
        );
    }

    subscribe(subscription: Subscription<T>) {
        this.subscriptions.push(subscription);
    }
}

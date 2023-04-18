import { MessageContext, messageContextFromString, messageContextToString } from "openchat-shared";
import { waitAll } from "./promise";

export class MessageContextMap<T> {
    constructor(private _map: Record<string, T[]> = {}) {}

    insert(context: MessageContext, val: T): void {
        const key = messageContextToString(context);
        if (this._map[key] === undefined) {
            this._map[key] = [];
        }
        this._map[key].push(val);
    }

    lookup(key: MessageContext): T[] {
        return this._map[messageContextToString(key)] ?? [];
    }

    async asycMap<A>(
        fn: (s: string, k: MessageContext, t: T[]) => Promise<[string, A[]]>
    ): Promise<MessageContextMap<A>> {
        const intermediate: Promise<[string, A[]]>[] = [];
        Object.entries(this._map).forEach(([key, val]) => {
            intermediate.push(fn(key, messageContextFromString(key), val));
        }, {} as Record<string, Promise<A[]>>);

        const result = await waitAll(intermediate);
        if (result.errors.length > 0) {
            console.error("Some missing indexes could not be resolved: ", result.errors);
        }
        return new MessageContextMap(
            result.success.reduce<Record<string, A[]>>((res, [messageContext, messages]) => {
                if (!res[messageContext]) {
                    res[messageContext] = [];
                }
                res[messageContext] = res[messageContext].concat(messages);
                return res;
            }, {})
        );
    }
}

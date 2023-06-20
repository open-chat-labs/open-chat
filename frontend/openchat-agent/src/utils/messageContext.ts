import { MessageContext, MessageContextMap } from "openchat-shared";
import { waitAll } from "./promise";

export class AsyncMessageContextMap<T> extends MessageContextMap<T[]> {
    insert(context: MessageContext, val: T): void {
        if (!this.has(context)) {
            this.set(context, []);
        }
        this.get(context)?.push(val);
    }

    public get length(): number {
        return this.size;
    }

    lookup(key: MessageContext): T[] {
        return this.get(key) ?? [];
    }

    async asyncMap<A>(
        fn: (k: MessageContext, t: T[]) => Promise<[MessageContext, A[]]>
    ): Promise<AsyncMessageContextMap<A>> {
        const intermediate: Promise<[MessageContext, A[]]>[] = [];
        this.entries().forEach(([key, val]) => {
            intermediate.push(fn(key, val));
        });

        const result = await waitAll(intermediate);
        if (result.errors.length > 0) {
            console.error("Some missing indexes could not be resolved: ", result.errors);
        }
        return result.success.reduce<AsyncMessageContextMap<A>>(
            (res, [messageContext, messages]) => {
                if (!res.has(messageContext)) {
                    res.set(messageContext, []);
                }
                res.get(messageContext)?.concat(messages);
                return res;
            },
            new AsyncMessageContextMap<A>()
        );
    }
}

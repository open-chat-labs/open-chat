import type { PubSubEvents } from "./pubsub_events";

type NoPayloadEvents = {
    [K in keyof PubSubEvents]: PubSubEvents[K] extends undefined ? K : never;
}[keyof PubSubEvents];

type Subscriptions = {
    [K in keyof PubSubEvents]?: ((payload: PubSubEvents[K]) => void)[];
};

type Subscription<K extends keyof PubSubEvents> = (payload: PubSubEvents[K]) => void;

type Unsubscribe = () => void;

const subscriptions: Subscriptions = {};

export function subscribe<K extends keyof PubSubEvents>(
    name: K,
    value: Subscription<K>,
): Unsubscribe {
    if (subscriptions[name] === undefined) {
        subscriptions[name] = [];
    }
    subscriptions[name]!.push(value);

    return () => {
        if (subscriptions[name]) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            subscriptions[name] = subscriptions[name]!.filter((s) => s !== value);
            if (subscriptions[name]!.length === 0) {
                delete subscriptions[name];
            }
        }
    };
}

export function publish<K extends NoPayloadEvents>(name: K): void;
export function publish<K extends keyof PubSubEvents>(name: K, payload: PubSubEvents[K]): void;
export function publish<K extends keyof PubSubEvents>(name: K, payload?: PubSubEvents[K]): void {
    subscriptions[name]?.forEach((sub) => sub(payload as PubSubEvents[K]));
}

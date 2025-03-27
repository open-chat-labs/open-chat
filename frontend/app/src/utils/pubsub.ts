import type { ChatSummary } from "openchat-client";

type Events = {
    startVideoCall: { chat: ChatSummary; join: boolean };
    hangup: undefined;
    askToSpeak: undefined;
};

type NoPayloadEvents = {
    [K in keyof Events]: Events[K] extends undefined ? K : never;
}[keyof Events];

type Subscriptions = {
    [K in keyof Events]?: ((payload: Events[K]) => void)[];
};

type Subscription<K extends keyof Events> = (payload: Events[K]) => void;

type Unsubscribe = () => void;

const subscriptions: Subscriptions = {};

export function subscribe<K extends keyof Events>(name: K, value: Subscription<K>): Unsubscribe {
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
export function publish<K extends keyof Events>(name: K, payload: Events[K]): void;
export function publish<K extends keyof Events>(name: K, payload?: Events[K]): void {
    subscriptions[name]?.forEach((sub) => sub(payload as Events[K]));
}

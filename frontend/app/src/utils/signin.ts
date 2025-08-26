import { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import {
    Poller,
    type GenerateMagicLinkResponse,
    type OpenChat,
    type TrackingCategory,
} from "openchat-client";
import { toastStore } from "../stores/toast";
import { i18nKey } from "../i18n/i18n";
import type { Subscriber, Unsubscriber } from "svelte/store";

export class EmailPollerError extends Event {
    constructor() {
        super("email_signin_event");
    }
}

export class EmailPollerSuccess extends CustomEvent<{
    kind: "success";
    key: ECDSAKeyIdentity;
    delegation: DelegationChain;
}> {
    constructor(key: ECDSAKeyIdentity, delegation: DelegationChain) {
        super("email_signin_event", { detail: { kind: "success", key, delegation } });
    }
}

/**
 * This will take care of generating the magic link and polling for the link being clicked.
 * It will also act as boolean svelte store to indicate whether we are current polling or not.
 */
export class EmailSigninHandler extends EventTarget {
    verificationCode: string | undefined;
    private poller: Poller | undefined;
    private subscribers: Subscriber<boolean>[] = [];

    constructor(
        private client: OpenChat,
        private trackingCategory: TrackingCategory,
        private assumeIdentity: boolean,
    ) {
        super();
    }

    public subscribe(sub: Subscriber<boolean>): Unsubscriber {
        this.subscribers.push(sub);
        sub(this.polling);
        return () => {
            this.subscribers = this.subscribers.filter((s) => s !== sub);
        };
    }

    publish(): void {
        this.subscribers.forEach((sub) => {
            sub(this.polling);
        });
    }

    destroy() {
        this.stopPolling();
    }

    stopPolling() {
        this.poller?.stop();
        this.poller = undefined;
        this.publish();
    }

    public get polling(): boolean {
        return this.poller !== undefined;
    }

    async generateMagicLink(
        email: string,
    ): Promise<GenerateMagicLinkResponse | { kind: "unexpected_error" }> {
        const sessionKey = await ECDSAKeyIdentity.generate();
        this.verificationCode = undefined;

        return this.client
            .generateMagicLink(email, sessionKey)
            .then((response) => {
                if (response.kind === "success") {
                    this.verificationCode = response.code;
                    this.client.gaTrack("generated_magic_signin_link", this.trackingCategory);
                    this.startPoller(email, sessionKey, response.userKey, response.expiration);
                }
                return response;
            })
            .catch((err) => {
                console.warn("generateMagicLink error", err);
                return { kind: "unexpected_error" };
            });
    }

    private startPoller(
        email: string,
        sessionKey: ECDSAKeyIdentity,
        userKey: Uint8Array,
        expiration: bigint,
    ) {
        this.poller = new Poller(
            async () => {
                if (this.poller !== undefined) {
                    this.client
                        .getSignInWithEmailDelegation(
                            email,
                            userKey,
                            sessionKey,
                            expiration,
                            this.assumeIdentity,
                        )
                        .then((response) => {
                            if (response.kind === "success") {
                                this.client.gaTrack(
                                    "received_email_signin_delegation",
                                    this.trackingCategory,
                                );
                                this.dispatchEvent(
                                    new EmailPollerSuccess(response.key, response.delegation),
                                );
                                this.stopPolling();
                            } else if (response.kind === "error") {
                                console.debug("getSignInWithEmailDelegation error", response.error);
                                this.dispatchEvent(new EmailPollerError());
                            }
                        })
                        .catch((err) => {
                            console.warn("getSignInWithEmailDelegation error", err);
                            this.dispatchEvent(new EmailPollerError());
                        });
                }
            },
            1000,
            1000,
        );
        this.publish();
    }

    copyCode(code: string | undefined) {
        if (code === undefined) return;

        navigator.clipboard.writeText(code).then(
            () => {
                toastStore.showSuccessToast(i18nKey("loginDialog.codeCopiedToClipboard"));
            },
            () => {
                toastStore.showFailureToast(i18nKey("loginDialog.failedToCopyCodeToClipboard"));
            },
        );
    }
}

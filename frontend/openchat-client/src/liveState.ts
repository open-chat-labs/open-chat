import type { AuthProvider, PinNumberResolver } from "openchat-shared";
import { locale } from "svelte-i18n";
import { selectedAuthProviderStore } from "./stores/authProviders";
import { offlineStore } from "./stores/network";
import { capturePinNumberStore, pinNumberRequiredStore } from "./stores/pinNumber";
import { remainingStorage } from "./stores/storage";
import { userCreatedStore } from "./stores/userCreated";

/**
 * Any stores that we reference inside the OpenChat client can be added here so that we always have the up to date current value
 * at hand without having to use svelte.get which will create and destroy a subscription every time
 */
export class LiveState {
    selectedAuthProvider!: AuthProvider | undefined;
    userCreated!: boolean;
    remainingStorage!: number;
    offlineStore!: boolean;
    locale!: string;
    pinNumberRequired!: boolean;
    capturePinNumber!: PinNumberResolver | undefined;

    constructor() {
        offlineStore.subscribe((offline) => (this.offlineStore = offline));
        remainingStorage.subscribe((data) => (this.remainingStorage = data));
        userCreatedStore.subscribe((data) => (this.userCreated = data));
        selectedAuthProviderStore.subscribe((data) => (this.selectedAuthProvider = data));
        locale.subscribe((data) => (this.locale = data ?? "en"));
        pinNumberRequiredStore.subscribe((data) => (this.pinNumberRequired = data));
        capturePinNumberStore.subscribe((data) => (this.capturePinNumber = data));
    }
}

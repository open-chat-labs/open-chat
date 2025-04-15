export function booleanFromLocalStorage(key: string, defaultVal: boolean): boolean {
    const val = localStorage.getItem(key);
    switch (val) {
        case "true":
            return true;
        case "false":
            return false;
        default:
            return defaultVal;
    }
}

class LocalStorageSetting {
    #value: boolean;

    constructor(
        private key: string,
        defaultVal: boolean,
    ) {
        this.#value = $state(booleanFromLocalStorage(key, defaultVal));
    }

    get value() {
        return this.#value;
    }

    set value(v: boolean) {
        localStorage.setItem(this.key, v.toString());
        this.#value = v;
    }

    toggle() {
        this.value = !this.value;
    }
}

class LocalStorageSettings {
    chitPopup = new LocalStorageSetting("openchat_chit_popup", true);
}

export const settings = new LocalStorageSettings();

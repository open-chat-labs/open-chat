import { writable, get } from "svelte/store";

const DATA_KEY = "openchat_android_interface_sizes";

type AndroidInterfaceSizes = {
    statusBarHeight: number;
    navBarHeight: number;
};

const storedValue = localStorage.getItem(DATA_KEY);
const initialValue = storedValue
    ? JSON.parse(storedValue)
    : {
          statusBarHeight: 0,
          navBarHeight: 0,
      };

export const androidInterfaceSizes = writable<AndroidInterfaceSizes>(initialValue);

androidInterfaceSizes.subscribe((value) => {
    localStorage.setItem(DATA_KEY, JSON.stringify(value));

    // Update data!
    setStatusAndNavBarSizesForNativeApp();
});

// Equality-gated update. The native inset listener reports status/nav bar sizes
// on every inset change (which includes every keyboard open/close frame), but
// they rarely actually change. Calling `.set()` unconditionally re-runs the
// subscriber above — a localStorage write plus two CSS-var writes, all of which
// cross into the WebView's native layer — so skip it when nothing moved.
export function updateAndroidInterfaceSizes(statusBarHeight: number, navBarHeight: number): void {
    const current = get(androidInterfaceSizes);
    if (current.statusBarHeight === statusBarHeight && current.navBarHeight === navBarHeight) {
        return;
    }
    androidInterfaceSizes.set({ statusBarHeight, navBarHeight });
}

export function setStatusAndNavBarSizesForNativeApp() {
    const current = get(androidInterfaceSizes);

    document.documentElement.style.setProperty(
        "--device-status-bar-height",
        `${current.statusBarHeight}px`,
    );

    document.documentElement.style.setProperty("--device-nav-height", `${current.navBarHeight}px`);
}

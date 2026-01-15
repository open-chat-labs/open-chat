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

export function setStatusAndNavBarSizesForNativeApp() {
    const current = get(androidInterfaceSizes);

    document.documentElement.style.setProperty(
        "--device-status-bar-height",
        `${current.statusBarHeight}px`,
    );

    document.documentElement.style.setProperty("--device-nav-height", `${current.navBarHeight}px`);
}

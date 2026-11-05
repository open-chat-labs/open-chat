// The native shell kit (native design notes §1, §2): the pieces the iOS and Android apps (and narrow mobile web) build
// their screens from. App-agnostic like src/lib: data in through props, everything out through callbacks. Each
// component expects a native root above it (data-platform="native", data-os="ios" | "android", data-mode,
// data-accent): the native light surfaces, touch targets, bar paddings, veils and shadows are tokens set there.
import { installBehaviours } from '../lib/behaviours';

installBehaviours();

export { default as TabBar } from './TabBar.svelte';
export { default as NativePageHeader } from './NativePageHeader.svelte';
export { haptic, setHaptics } from './haptics';
export type { HapticStyle, Haptics } from './haptics';
export type { NativeHeaderAction, NativeTab } from './types';

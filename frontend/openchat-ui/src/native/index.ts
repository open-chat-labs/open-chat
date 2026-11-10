// The native shell kit (native design notes §1, §2): the pieces the iOS and Android apps (and narrow mobile web) build
// their screens from. App-agnostic like src/lib: data in through props, everything out through callbacks. Each
// component expects a native root above it (data-platform="native", data-os="ios" | "android", data-mode,
// data-accent): the native light surfaces, touch targets, bar paddings, veils and shadows are tokens set there.
import { installBehaviours } from '../lib/behaviours';

installBehaviours();

export { default as TabBar } from './TabBar.svelte';
export { default as NativePageHeader } from './NativePageHeader.svelte';
export { default as BottomSheet } from './BottomSheet.svelte';
export { default as NativeMenu } from './NativeMenu.svelte';
export { default as AnchoredMenu } from './AnchoredMenu.svelte';
export { default as NativeAlert } from './NativeAlert.svelte';
export { default as LongPressMenu } from './LongPressMenu.svelte';
export { default as MessageLongPressMenu } from './MessageLongPressMenu.svelte';
export { default as SettingsGroup } from './SettingsGroup.svelte';
export { default as SettingsSwitch } from './SettingsSwitch.svelte';
export { default as SettingsValue } from './SettingsValue.svelte';
export { default as SettingsLink } from './SettingsLink.svelte';
export { default as SettingsCopy } from './SettingsCopy.svelte';
export { default as SettingsSegmented } from './SettingsSegmented.svelte';
export { default as SettingsSwatches } from './SettingsSwatches.svelte';
export { default as SettingsMeter } from './SettingsMeter.svelte';
export { default as SettingsAction } from './SettingsAction.svelte';
export { default as CodeTiles } from './CodeTiles.svelte';
export { default as Toasts } from './Toasts.svelte';
export { haptic, setHaptics } from './haptics';
export type { HapticStyle, Haptics } from './haptics';
export { Presence } from './presence.svelte';
export { CLOSE_FRACTION, RUBBER_BAND, releaseVelocity, sheetOffset, sheetRelease, veilOpacity } from './sheetDrag';
export type { DragSample, SheetRelease } from './sheetDrag';
export { LONG_PRESS_MS, LongPressGesture, MOVE_TOLERANCE, longPress } from './longPress';
export { anchoredPlacement, liftPlacement, menuHeight, messageMenuPlacement } from './menuPlacement';
export type { AnchoredPlacement, LiftPlacement, MessageMenuOrder, MessageMenuPlacement, Rect } from './menuPlacement';
export { codeTiles, normaliseCode } from './codeTiles';
export type { CodeTile } from './codeTiles';
export { TOAST_MS, ToastQueue, UNDO_TOAST_MS } from './toastQueue.svelte';
export type { NativeToast } from './toastQueue.svelte';
export type { NativeHeaderAction, NativeMenuItem, NativeTab } from './types';

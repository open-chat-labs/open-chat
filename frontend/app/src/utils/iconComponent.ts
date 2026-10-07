import type { Component, SvelteComponent } from "svelte";

// A component passed in to render an icon: svelte-material-icons are class components, our own icons are runes components.
export type IconComponent =
    | typeof SvelteComponent<{ color?: string; size?: string | number }>
    | Component<{ color?: string; size?: string }>;

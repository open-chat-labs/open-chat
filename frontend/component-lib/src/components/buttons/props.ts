import { type SizeMode } from "component-lib";
import { type Snippet } from "svelte";

export type ButtonProps = {
    children?: Snippet;
    disabled?: boolean;
    loading?: boolean;
    secondary?: boolean;
    onClick?: (e: MouseEvent) => void;
    icon?: Snippet<[string]>;
    width?: SizeMode;
    height?: SizeMode;
    danger?: boolean;
};

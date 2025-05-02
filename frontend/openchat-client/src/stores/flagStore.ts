import { type ModerationFlag } from "openchat-shared";

export function hasFlag(mask: number, flag: ModerationFlag): boolean {
    return (mask & flag) !== 0;
}

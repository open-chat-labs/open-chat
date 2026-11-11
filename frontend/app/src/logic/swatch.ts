import { pickById } from "@src/utils/pickById";

// The swatch a person, chat or community without a picture of its own shows (GAPS.md, Swatches):
// one of the library's Avatar gradients (`AVATAR_GRADIENTS`, whose names these are), picked from the
// id. Every screen picks it here, so the same id has the same swatch everywhere: a person's in the
// chat list, their messages, their DM's panel and their profile; a community's on the rail, in its
// panel and in a profile's list of communities.

export const SWATCHES = ["violet", "blue", "teal", "amber", "plum"] as const;
export type Swatch = (typeof SWATCHES)[number];

export function swatchFor(id: string): Swatch {
    return pickById(id, SWATCHES);
}

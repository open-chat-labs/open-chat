// The banner that offers a reload when the window is resized across the line between the phone
// layout and the desktop one (web plan 10b). The trees never swap live: `selectLayout` picks one
// at load, and a reload of the same URL picks again. Every tree that can be on either side of the
// line shows it, each with its own look.

import type { ResourceKey } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { Debouncer } from "@src/utils/debouncer";
import { layoutSwitchAt, type LayoutSwitch, type StartupLayout } from "@src/utils/layout";

// How long the width has to stay put before the banner follows it, so that dragging a window's
// edge back and forth across the line doesn't flicker it
export const LAYOUT_SWITCH_SETTLE_MS = 400;

export class LayoutSwitchBanner {
    #startup: StartupLayout | undefined;
    #switch = $state<LayoutSwitch>();
    #dismissed = $state(false);
    #settle: Debouncer<number>;

    /** `startup` is what main.ts mounted; without it the banner never shows. */
    constructor(startup: StartupLayout | undefined, settleMs = LAYOUT_SWITCH_SETTLE_MS) {
        this.#startup = startup;
        this.#settle = new Debouncer((width: number) => this.#follow(width), settleMs);
    }

    /** The switch a reload would make, unless the user has dismissed it. */
    get offer(): LayoutSwitch | undefined {
        return this.#dismissed ? undefined : this.#switch;
    }

    /** What the banner says for the offer. */
    get message(): ResourceKey | undefined {
        switch (this.offer) {
            case "phone":
                return i18nKey("layoutSwitch.toPhone");
            case "desktop":
                return i18nKey("layoutSwitch.toDesktop");
            default:
                return undefined;
        }
    }

    /** The window's width now; the banner follows it once it settles. */
    widthChanged(width: number): void {
        this.#settle.execute(width);
    }

    /** Hidden until the window crosses back over the line and then over it again. */
    dismiss(): void {
        this.#dismissed = true;
    }

    destroy(): void {
        this.#settle.cancel();
    }

    #follow(width: number): void {
        if (this.#startup === undefined) return;
        const next = layoutSwitchAt(this.#startup, width);
        // back on the loaded tree's side: the next crossing offers the reload again
        if (next === undefined) this.#dismissed = false;
        this.#switch = next;
    }
}

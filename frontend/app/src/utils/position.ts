type Direction = "top" | "left" | "bottom" | "right";
type Alignment = "start" | "middle" | "end";

export type VariantFlipOrder = {
    start: string;
    middle: string;
    end: string;
};

export type PositionFlipOrder = {
    top: string;
    right: string;
    bottom: string;
    left: string;
};

export type NanoPopPosition = `${Direction}-${Alignment}` | Direction;

export type NanoPopOptions = {
    container: DOMRect;
    position: NanoPopPosition;
    variantFlipOrder: VariantFlipOrder;
    positionFlipOrder: PositionFlipOrder;
    margin: number;
    reference?: HTMLElement;
    popper?: HTMLElement;
    arrow?: HTMLElement;
    padding?: number;
    force?: boolean;
};

type AvailablePositions = {
    t: number;
    b: number;
    l: number;
    r: number;
};

type AvailableVariants = {
    vs: number;
    vm: number;
    ve: number;
    hs: number;
    hm: number;
    he: number;
};

type PositionPairs = [Direction, Direction];

export type PositionMatch =
    | "ts"
    | "tm"
    | "te"
    | "bs"
    | "bm"
    | "be"
    | "ls"
    | "lm"
    | "le"
    | "rs"
    | "rm"
    | "re";

export interface NanoPop {
    update(updatedOptions?: Partial<NanoPopOptions>): PositionMatch | null;
}

export interface NanoPopConstructor {
    /**
     * @param reference Reference element
     * @param popper Actual popper element
     * @param options Optional options
     */
    (reference: HTMLElement, popper: HTMLElement, options?: Partial<NanoPopOptions>): NanoPop;

    /**
     * @param options Partial options which get merged with the current one
     */
    (options?: Partial<NanoPopOptions>): NanoPop;
}

// Export default
export const defaults = {
    variantFlipOrder: { start: "sme", middle: "mse", end: "ems" },
    positionFlipOrder: { top: "tbrl", right: "rltb", bottom: "btrl", left: "lrbt" },
    position: "bottom",
    margin: 8,
    padding: 0,
    force: false,
};

export function reposition(
    trigger: HTMLElement,
    popup: HTMLElement,
    opt?: Partial<NanoPopOptions>,
): PositionMatch | null {
    const pos = repositionInternal(trigger, popup, opt);
    return pos ? pos : repositionInternal(trigger, popup, { ...opt, force: true });
}

/**
 * Repositions an element once using the provided options and elements.
 * @param trigger Reference element
 * @param popup Popper element
 * @param opt Optional, additional options
 */
const repositionInternal = (
    trigger: HTMLElement,
    popup: HTMLElement,
    opt?: Partial<NanoPopOptions>,
): PositionMatch | null => {
    const {
        container,
        arrow,
        margin,
        padding,
        position,
        variantFlipOrder,
        positionFlipOrder,
        force,
    } = {
        container: document.documentElement.getBoundingClientRect(),
        ...defaults,
        ...opt,
    };

    /**
     * Reset position to resolve viewport
     * See https://developer.mozilla.org/en-US/docs/Web/CSS/position#fixed
     */
    const { left: originalLeft, top: originalTop } = popup.style;
    popup.style.left = "0";
    popup.style.top = "0";

    const triggerBox = trigger.getBoundingClientRect();
    const popupBox = popup.getBoundingClientRect();

    /**
     * Holds coordinates of top, left, bottom and right alignment
     */
    const positionStore: AvailablePositions = {
        t: triggerBox.top - popupBox.height - margin,
        b: triggerBox.bottom + margin,
        r: triggerBox.right + margin,
        l: triggerBox.left - popupBox.width - margin,
    };

    /**
     * Holds corresponding variants (start, middle, end).
     * The values depend on horizontal / vertical orientation
     */
    const variantStore: AvailableVariants = {
        vs: triggerBox.left,
        vm: triggerBox.left + triggerBox.width / 2 - popupBox.width / 2,
        ve: triggerBox.left + triggerBox.width - popupBox.width,
        hs: triggerBox.top,
        hm: triggerBox.bottom - triggerBox.height / 2 - popupBox.height / 2,
        he: triggerBox.bottom - popupBox.height,
    };

    // Extract position and variant
    // Top-start -> top is "position" and "start" is the variant
    const [posKey, varKey = "middle"] = position.split("-");
    const positions = positionFlipOrder[posKey as keyof PositionFlipOrder];
    const variants = variantFlipOrder[varKey as keyof VariantFlipOrder];

    // Try out all possible combinations, starting with the preferred one.
    const { top, left, bottom, right } = container;

    for (const p of positions) {
        const vertical = p === "t" || p === "b";

        // The position-value
        let positionVal = positionStore[p as keyof AvailablePositions];

        // Which property has to be changes.
        const [positionKey, variantKey] = (
            vertical ? ["top", "left"] : ["left", "top"]
        ) as PositionPairs;

        const overrideProp = vertical ? "--override-height" : "--override-width";

        /**
         * box refers to the size of the popper element. Depending on the orientation this is width or height.
         * The limit is the corresponding, maximum value for this position.
         */
        const [positionSize, variantSize] = vertical
            ? [popupBox.height, popupBox.width]
            : [popupBox.width, popupBox.height];

        const [positionMaximum, variantMaximum] = vertical ? [bottom, right] : [right, bottom];
        const [positionMinimum, variantMinimum] = vertical ? [top, left] : [left, top];
        const positionTotal = positionVal + positionSize + padding;

        // Skip pre-clipped values
        if (positionVal < positionMinimum || positionTotal > positionMaximum) {
            console.debug("POS: position will not fit: ", p);
            if (force) {
                console.debug("POS: forcing popup position to fit: ", p);
                if (positionTotal > positionMaximum) {
                    popup.style.setProperty(
                        overrideProp,
                        `${positionSize - (positionTotal - positionMaximum)}px`,
                    );
                }
                if (positionVal < positionMinimum) {
                    const diff = positionMinimum - positionVal;
                    popup.style.setProperty(overrideProp, `${positionSize - diff}px`);
                    positionVal += diff;
                }
            } else {
                continue;
            }
        }

        for (const v of variants) {
            // The position-value, the related size value of the popper and the limit
            let variantVal = variantStore[((vertical ? "v" : "h") + v) as keyof AvailableVariants];
            const variantTotal = variantVal + variantSize + padding;

            if (variantVal < variantMinimum || variantTotal > variantMaximum) {
                console.debug("POS: variation will not fit: ", v);
                if (force) {
                    console.debug("POS: forcing popup variation to fit: ", v);
                    if (variantTotal > variantMaximum) {
                        popup.style.setProperty(
                            overrideProp,
                            `${variantSize - (variantTotal - variantMaximum)}px`,
                        );
                    }
                    if (variantVal < variantMinimum) {
                        const diff = variantMinimum - positionVal;
                        popup.style.setProperty(overrideProp, `${variantSize - diff}px`);
                        variantVal += diff;
                    }
                } else {
                    continue;
                }
            }

            // Subtract popBox's initial position
            variantVal -= popupBox[variantKey];
            positionVal -= popupBox[positionKey];

            // Apply styles and normalize viewport
            popup.style[variantKey] = `${variantVal}px`;
            popup.style[positionKey] = `${positionVal}px`;

            if (arrow) {
                // Calculate refBox's center offset from its variant position for arrow positioning
                const refBoxCenterOffset = vertical ? triggerBox.width / 2 : triggerBox.height / 2;

                // When refBox is larger than popBox, have the arrow's variant position be the center of popBox instead.
                const arrowVariantVal =
                    refBoxCenterOffset * 2 < variantSize
                        ? triggerBox[variantKey] + refBoxCenterOffset
                        : variantVal + variantSize / 2;

                // Arrow position is either on one side of the popBox or the other.
                if (positionVal < triggerBox[positionKey]) {
                    positionVal += positionSize;
                }

                // Apply styles to arrow
                arrow.style[variantKey] = `${arrowVariantVal}px`;
                arrow.style[positionKey] = `${positionVal}px`;
            }

            return (p + v) as PositionMatch;
        }
    }

    // Revert style values (won't work with styled-elements or similar systems)
    // "Fix" for https://github.com/Simonwep/nanopop/issues/7
    popup.style.left = originalLeft;
    popup.style.top = originalTop;

    return null;
};

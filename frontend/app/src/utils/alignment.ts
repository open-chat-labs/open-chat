/**
 * This is used to calculate the position of thing A according to the required
 * alignment to thing B.
 *
 * It is used for both tooltips and menus
 */
export type Position = "top" | "right" | "bottom" | "left";
export type Alignment = "start" | "middle" | "end";
export type Dimensions = {
    x: number;
    y: number;
    w: number;
    h: number;
};

function viewportDimensions(): { w: number; h: number } {
    return {
        w: window.innerWidth || document.documentElement.clientWidth,
        h: window.innerHeight || document.documentElement.clientHeight,
    };
}

export function centerOfScreen(elementRect: DOMRect): Dimensions {
    const viewport = viewportDimensions();
    const centerX = viewport.w / 2;
    const centerY = viewport.h / 2;
    return {
        x: centerX - elementRect.width / 2,
        y: centerY - elementRect.height / 2,
        w: elementRect.width,
        h: elementRect.height,
    };
}

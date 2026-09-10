export * from "./types";
// Each game's helpers keep short names inside its module (parseDescription, checkRules, ...);
// only the DailyGame object and its types are exported from the package to avoid clashes.
export {
    lightUp,
    type LightUpCell,
    type LightUpDescCell,
    type LightUpDescription,
    type LightUpViolation,
} from "./lightUp";
export {
    tents,
    tentsColumnKey,
    tentsRowKey,
    type TentsCell,
    type TentsDescription,
    type TentsViolation,
} from "./tents";
export {
    slant,
    slantVertexLines,
    type SlantCell,
    type SlantDescription,
    type SlantViolation,
} from "./slant";
export {
    bridges,
    bridgesIslandTotals,
    type BridgesDescription,
    type BridgesEdge,
    type BridgesState,
    type BridgesViolation,
} from "./bridges";
export {
    loopy,
    loopyCellEdges,
    loopyCellKey,
    loopyCellLines,
    loopyDotKey,
    loopyEdgeCount,
    type LoopyDescription,
    type LoopyEdge,
    type LoopyViolation,
} from "./loopy";
export {
    unruly,
    unrulyColumnTarget,
    unrulyGrid,
    unrulyRowTarget,
    type UnrulyCell,
    type UnrulyDescription,
    type UnrulyViolation,
} from "./unruly";

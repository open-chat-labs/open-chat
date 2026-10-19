import { keysOf } from "../gridSvg";

/** Cells that get the red ring: every cell of the value an overfull row or column has too many
 * of, and the three cells of a run. A run's discs also go red, but the ring is what shows it
 * to players who can't tell that red from the disc colour. */
export function ringedKeys(violations: { keys: number[]; kind: string }[]): Set<number> {
    return keysOf(violations, "row_count", "column_count", "run");
}

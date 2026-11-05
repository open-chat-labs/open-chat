// The bottom sheet's drag (native design notes §1 Sheets): its handle and header drag it; past 30% of its height or a
// downward flick closes it, otherwise it springs back; pulled up it rubber-bands, 24px at most. Pure, so BottomSheet
// only feeds it pointer positions.

/** How far up the sheet follows a pull, at most. */
export const RUBBER_BAND = 24;
/** The share of its height a sheet is dragged down past to close on release. */
export const CLOSE_FRACTION = 0.3;
/** A release faster than this downwards (px/ms) is a flick, which closes. */
export const FLICK_VELOCITY = 0.5;
/** A flick has to have moved the sheet at least this far down, so a tap's jitter isn't one. */
export const FLICK_MIN_DISTANCE = 12;
/** The velocity is read over the last this many ms only, so a hold before letting go reads as no flick. */
export const VELOCITY_WINDOW = 100;

/** A pointer position during the drag: when (ms) and where (clientY, px). */
export type DragSample = { t: number; y: number };

export type SheetRelease = 'close' | 'settle';

/** Where the sheet sits for a pointer `dy` px below where the drag started: down, under the finger; up, a quarter of
 *  the pull, at most RUBBER_BAND. */
export function sheetOffset(dy: number): number {
  return dy < 0 ? Math.max(-RUBBER_BAND, dy / 4) : dy;
}

/** The pointer's speed at `now` in px/ms (down is positive), over the samples of the last VELOCITY_WINDOW ms; 0
 *  with fewer than two of them. */
export function releaseVelocity(samples: DragSample[], now: number): number {
  const recent = samples.filter((s) => now - s.t <= VELOCITY_WINDOW);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  return (last.y - first.y) / Math.max(1, last.t - first.t);
}

/** What letting go does: the pointer `dy` px below where it started, on a sheet `height` px tall, moving at
 *  `velocity` px/ms. */
export function sheetRelease(dy: number, height: number, velocity: number): SheetRelease {
  if (dy > height * CLOSE_FRACTION) return 'close';
  return velocity > FLICK_VELOCITY && dy > FLICK_MIN_DISTANCE ? 'close' : 'settle';
}

/** The veil's opacity with the sheet `offset` px down: lighter as it goes, never under 0.35. */
export function veilOpacity(offset: number): number {
  return Math.max(0.35, 1 - Math.max(0, offset) / 500);
}

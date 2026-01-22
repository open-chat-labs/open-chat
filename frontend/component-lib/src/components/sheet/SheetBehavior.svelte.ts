import { fraction } from "../../utils/fraction";

// Transient sheets fully open and close. Anchored sheets have a collapsed/minimised
// and expanded/maximised view, and never go out of view.
type SheetType = "transient" | "anchored";

export class SheetBehavior {
    private _sheetType: SheetType = "transient";

    // Config for the dragger class!
    maxViewportHeightFraction = fraction(0.8);
    openThreshold = fraction(0.2);
    closeThreshold = fraction(0.9);
    speed = 500;

    // State vars
    sheet = $state<HTMLElement | undefined>();
    handle = $state<HTMLElement | undefined>();
    dragged = $state(false);
    isExpanded = $state(false);

    // TODO perhaps we could use Svelte Tween, instead of tracking animation
    openFactor = $state(0);

    // Local vars
    private _startY: undefined | number;
    private _startHeight: undefined | number;

    // Max allowed height for a sheet, which is calculated as a function of
    // the available viewport, and fraction of the viewport the sheet can take.
    private _maxHeight = 0;

    // Max height to which we expand the sheet
    private _expandedHeight = 0;

    // If the collapsed height is kept at zero value, we consider the sheet
    // using this dragger class a transient one (toggles on/off); but if this
    // value is set, then we consider the sheet to be persistent with minimised
    // and expanded states.
    private _collapsedHeight = 0;

    // Callbacks, used as public vars
    onCollapsed: (() => void) | undefined = undefined;
    onExpanded: (() => void) | undefined = undefined;

    // Vars below are used during the snapping phase, to update the openFactor
    // value. The _animation itself is a CSS transition, but openFactor is used
    // to fade the content in/out.
    private _animating = false;
    private _animationStart = 0;
    private _animationFrom = 0;
    private _animationTo: 0 | 1 = 1;
    private _animationDuration = 0;
    private _animationResolver?: () => void;

    //
    // Public methods
    //

    constructor(sheetType?: SheetType) {
        if (sheetType) this._sheetType = sheetType;
    }

    init(instantShow = false): () => void {
        this._calcSheetHeight();
        this._switch({
            transient: () => {
                // By default, transient sheets start expanded when they render!
                this._setSheetTransform(this._expandedHeight);
                requestAnimationFrame(() => this.expand(instantShow));
            },
            anchored: () => {
                // By default anchored sheet is collapsed
                // TODO make the default height configurable
                // TODO plugin instantShow
                this._collapsedHeight = this.sheet?.offsetHeight ?? 100;
            },
        });

        // Factor in viewport resizes
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", this._handleViewportChange);
        }

        // Return unmount fn
        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener("resize", this._handleViewportChange);
            }
        };
    }

    collapse(): Promise<void> {
        return new Promise<void>((resolve) => {
            this._animationResolver = resolve;

            if (!this.isExpanded) return resolve();

            this.isExpanded = false;
            if (this._sheetType == "transient" || this._collapsedHeight > 0) {
                this._snapTo(0);
            }
        });
    }

    expand(instant?: boolean): Promise<void> {
        return new Promise<void>((resolve) => {
            this._animationResolver = resolve;

            if (this.isExpanded) return resolve();

            this.isExpanded = true;
            if (instant) {
                this.openFactor = 1;
                this._switch({
                    transient: () => this._setSheetTransform(0),
                    anchored: () => this._setSheetHeight(this._expandedHeight),
                });
            } else {
                this._snapTo(1);
            }
        });
    }

    // Only track movement in y dimension!
    onDragStart(e: PointerEvent) {
        // Remove any transition that may be attached to the sheet...
        this._clearSheetTransition();

        // Set handle as the target for future drag events!
        this.handle?.setPointerCapture(e.pointerId);

        // If the user grabs handle in the middle of _animation!
        this.dragged = true;
        this._animating = false;
        this._startY = e.clientY;
        this._startHeight = this.sheet?.getBoundingClientRect().height;
    }

    onDrag(e: PointerEvent) {
        // Bound value to 0..1
        const bounded = (num: number) => Math.min(1, Math.max(0, num));

        if (!this.handle?.hasPointerCapture(e.pointerId) || this._startY == null) return;

        // How much did we drag...
        const delta = this._startY - e.clientY;

        this._switch({
            transient: () => {
                // The number will actually be inverted!
                if (delta > 0) return;

                // Calc the fraction of the sheet that's collapsed
                this.openFactor = bounded(
                    (this._expandedHeight - Math.abs(delta)) / this._expandedHeight,
                );

                // For transient sheet we set transform
                this._setSheetTransform(Math.abs(delta));
            },
            anchored: () => {
                if (!this._startHeight) return;

                const currentHeight = Math.min(
                    this._expandedHeight,
                    Math.max(this._collapsedHeight, this._startHeight + delta),
                );

                // Calc the fraction of the sheet that's collapsed/expanded
                this.openFactor = bounded(
                    (currentHeight - this._collapsedHeight) /
                        (this._expandedHeight - this._collapsedHeight),
                );

                // For anchored sheet we set height
                this._setSheetHeight(currentHeight);
            },
        });
    }

    onDragStop(e: PointerEvent) {
        if (this.handle?.hasPointerCapture(e.pointerId)) {
            this.handle.releasePointerCapture(e.pointerId);
        }

        this.dragged = false;
        this._startY = undefined;
        this._startHeight = undefined;

        this._switch({
            transient: () => {
                // We only consider closing the transient sheets
                if (this.openFactor <= this.closeThreshold) {
                    this.collapse();
                } else {
                    this.expand();
                }
            },
            anchored: () => {
                // Anchored sheets may be open or closed
                if (this.isExpanded) {
                    if (this.openFactor <= this.closeThreshold) {
                        this.collapse();
                    } else {
                        this.expand();
                    }
                } else {
                    if (this.openFactor >= this.openThreshold) {
                        this.expand();
                    } else {
                        this.collapse();
                    }
                }
            },
        });
    }

    //
    // Private methods
    //

    // Using lambda here, since they preserve 'this' context
    private _handleViewportChange = () => {
        // Viewport changed, figure out new heights!s
        this._calcSheetHeight();

        // Expand to the set height immediatelly
        if (this.isExpanded) this.expand(true);
    };

    // Must be called when component mounts! This function makes sure that the
    // sheet expands to the desired height, and that we remember what this
    // height should be compared to the avilable viewport.
    private _calcSheetHeight() {
        this._maxHeight = Math.round(
            (window.visualViewport?.height ?? window.innerHeight) * this.maxViewportHeightFraction,
        );

        if (this._sheetType === "transient") {
            this._clearSheetMaxHeight();

            // Current height of the transient sheet...
            const sheetHeight = this.sheet?.offsetHeight ?? this._maxHeight;

            // Transient sheets height should be between their natural height
            // and the max height determined by the max viewport height fraction.
            this._expandedHeight = Math.min(sheetHeight, this._maxHeight);

            // Indicate max height for a transient sheet!
            this._setSheetMaxHeight(this._maxHeight);
        } else {
            // Anchored sheets are a bit trickier, since we don't know the
            // height of the expanded content, we need to use the max viewport
            // fraction.
            this._expandedHeight = this._maxHeight;
        }
    }

    private _switch<T>(cases: { transient: () => T; anchored: () => T }): T {
        switch (this._sheetType) {
            case "transient":
                return cases.transient();
            case "anchored":
                return cases.anchored();
            default: {
                const _unknown: never = this._sheetType;
                throw new Error(`Unhandled sheet type: ${_unknown}`);
            }
        }
    }

    // Transition transform for transient sheets
    private _setSheetTransform(delta: number) {
        if (this.sheet) this.sheet.style.transform = `translateY(${delta}px)`;
    }

    // Transition height for anchored sheets
    // TODO transition scaleY instead of height, or translateY as alternative though a bit trickier.
    private _setSheetHeight(height: number) {
        if (this.sheet) this.sheet.style.height = `${height}px`;
    }

    private _setSheetMaxHeight(maxHeight: number) {
        if (this.sheet) this.sheet.style.maxHeight = `${maxHeight}px`;
    }

    private _clearSheetMaxHeight() {
        if (this.sheet) this.sheet.style.maxHeight = "none";
    }

    private _setSheetTransition(duration: number) {
        if (this.sheet) {
            // Depending on the sheet type, we transition different properties
            const prop = "transient" === this._sheetType ? "transform" : "height";

            // TODO set transition curve configurable
            this.sheet.style.transition = `${prop} ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
        }
    }

    private _clearSheetTransition() {
        if (this.sheet) this.sheet.style.transition = "none";
    }

    // Snap duration depends on how much the sheet is currently open - openessFactor -,
    // it's expanded height compared to max allowed height - scaleByHeightFactor -,
    // and whether we're trying to collapse or expand it.
    private _snapDuration(openessFactor: number, target: 0 | 1) {
        let duration: number;

        // This factor will perserve the perceived speed of opening the modal.
        // In case the modal needs to open to 50% of the max height, it will
        // take half the speed; and if it needs to open fully it will take
        // full speed.
        const scaleByHeightFactor = this._expandedHeight / this._maxHeight;

        if (target === 1) {
            duration = ((1 - openessFactor) / (1 - this.openThreshold)) * this.speed;
        } else {
            duration = (openessFactor / this.closeThreshold) * this.speed;
        }

        return scaleByHeightFactor * Math.max(0, Math.min(this.speed, duration));
    }

    // This function sets the CSS height transition for the sheet, and starts
    // the _animation tracker function.
    private _snapTo(target: 0 | 1) {
        this._animating = true;
        this._animationStart = performance.now();
        this._animationFrom = this.openFactor;
        this._animationTo = target;
        this._animationDuration = this._snapDuration(this._animationFrom, target);

        this._switch({
            transient: () => {
                // Either set translation to zero, or full height of the sheet
                this._setSheetTransform(target == 1 ? 0 : this._expandedHeight);
            },
            anchored: () => {
                this._setSheetHeight(target === 1 ? this._expandedHeight : this._collapsedHeight);

                // With anchored sheets, shorten the duration for the content
                // fade ins, so that they would finish by the time CSS
                // transition is done.
                this._animationDuration *= 0.9;
            },
        });

        this._setSheetTransition(this._animationDuration);
        requestAnimationFrame(this._trackAnimation);
    }

    // Just tracks along the expected CSS _animation duration and updates the
    // openFactor value. It does NOT animate the sheet transition!
    //
    // As before, using a lambda here to preserve 'this'.
    private _trackAnimation = (now: number) => {
        if (!this._animating) return;

        const elapsed = now - this._animationStart;
        const t =
            this._animationDuration === 0 ? 1 : Math.min(elapsed / this._animationDuration, 1);

        this.openFactor = this._animationFrom + (this._animationTo - this._animationFrom) * t;

        if (t < 1) {
            requestAnimationFrame(this._trackAnimation);
        } else {
            this.openFactor = this._animationTo;
            this._animating = false;

            if (this.openFactor === 0) {
                if ("function" === typeof this.onCollapsed) {
                    this.onCollapsed();
                }
            } else {
                if ("function" === typeof this.onExpanded) {
                    this.onExpanded();
                }
            }

            // Resolve when animation ends!
            if (this._animationResolver) this._animationResolver();
        }
    };
}

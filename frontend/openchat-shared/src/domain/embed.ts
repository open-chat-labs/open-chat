export type RestrictTo = "selected_community" | "selected_chat";

export type XFrameOverrides = {
    // obsolete - disableLeftNav is equivalent to restrictTo "selected_community"
    disableLeftNav?: boolean;
    restrictTo?: RestrictTo;
};

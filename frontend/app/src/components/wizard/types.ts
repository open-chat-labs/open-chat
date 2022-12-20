import type { Readable } from "svelte/store";

export type WizardState = {
    currentStep: Readable<number>;
    next: () => void;
    previous: () => void;
};

import type { ResourceKey } from "./i18n";

export type ValidationErrorMessages = ResourceKey[]; // this might not be enough

export class ValidationErrors {
    private errors = new Map<string, ValidationErrorMessages>();

    addErrors(key: string, errors: ResourceKey | ResourceKey[]) {
        if (!Array.isArray(errors)) errors = [errors];
        if (errors.length === 0) return;
        const current = this.errors.get(key) ?? [];
        errors.forEach((e) => current.push(e));
        this.errors.set(key, current);
    }

    has(key: string) {
        return this.errors.has(key);
    }

    get(key: string): ValidationErrorMessages {
        return this.errors.get(key) ?? [];
    }

    get size() {
        return this.errors.size;
    }
}

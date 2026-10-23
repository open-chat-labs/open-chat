// The current user's profile being edited: username, display name and bio, in every tree. A field
// the user hasn't touched follows the saved profile (as it loads, or after a save); one they have
// keeps their value until it saves. Saving sends only the changed fields (OpenChat.saveProfile).

import {
    isDisplayNameValid,
    MAX_BIO_LENGTH,
    profileChanges,
    type OpenChat,
    type ProfileChanges,
    type ProfileFieldErrors,
    type PublicProfile,
    type ResourceKey,
} from "@client";
import { UsernameCheck } from "./usernameCheck.svelte";

export type ProfileSaveOutcome =
    // nothing to send: no changes, a field not valid yet, the username still being checked, or
    // read-only
    | { kind: "nothing" }
    // every changed field saved
    | { kind: "saved" }
    // the backend turned down a field; its reason is in `errors`, under the field
    | { kind: "rejected" }
    // something the user can't fix in the form (they may still have saved some fields)
    | { kind: "failed"; reason: ResourceKey };

// an edited field's value; undefined while the field follows the saved profile
type Edit<T> = { value: T } | undefined;

export class ProfileForm {
    #client: Pick<OpenChat, "saveProfile" | "checkUsername" | "logError">;
    #saved: () => PublicProfile;
    #readOnly: () => boolean;
    #displayName = $state<Edit<string | undefined>>();
    #bio = $state<Edit<string>>();
    // the username the backend turned down, whose reason shows until it's changed
    #rejectedUsername = $state<string>();

    readonly username: UsernameCheck;
    saving = $state(false);
    // why the backend turned down a field, as an i18n key, under the field
    errors = $state<ProfileFieldErrors>({});

    /**
     * `saved` is the user's saved profile (currentUserProfileStore); `readOnly` is whether they may
     * edit it (not while suspended, nor as a guest).
     */
    constructor(
        client: Pick<OpenChat, "saveProfile" | "checkUsername" | "logError">,
        saved: () => PublicProfile,
        readOnly: () => boolean,
    ) {
        this.#client = client;
        this.#saved = saved;
        this.#readOnly = readOnly;
        this.username = new UsernameCheck(client, () => saved().username, { ownName: true });
    }

    get displayName(): string | undefined {
        return this.#displayName === undefined
            ? this.#saved().displayName
            : this.#displayName.value;
    }

    /**
     * No display name, an empty one included, is none. The saved name isn't an edit: the field
     * keeps following the saved profile.
     */
    set displayName(value: string | undefined) {
        const name = value === "" ? undefined : value;
        this.#displayName = name === this.#saved().displayName ? undefined : { value: name };
    }

    get bio(): string {
        return this.#bio === undefined ? this.#saved().bio : this.#bio.value;
    }

    /** The saved bio isn't an edit: the field keeps following the saved profile. */
    set bio(value: string) {
        this.#bio = value === this.#saved().bio ? undefined : { value };
    }

    /** Why the username can't be used: the check's reason, or the backend's for the name it turned down. */
    get usernameError(): string | undefined {
        const rejected = this.username.value === this.#rejectedUsername;
        return this.username.error ?? (rejected ? this.errors.username : undefined);
    }

    get readOnly(): boolean {
        return this.#readOnly();
    }

    get displayNameValid(): boolean {
        const name = this.displayName;
        return name === undefined || isDisplayNameValid(name);
    }

    get bioValid(): boolean {
        return this.bio.length <= MAX_BIO_LENGTH;
    }

    /** The profile as it would be saved. */
    get candidate(): PublicProfile {
        return {
            ...this.#saved(),
            username: this.username.value,
            displayName: this.displayName,
            bio: this.bio,
        };
    }

    get changes(): ProfileChanges {
        return profileChanges(this.#saved(), this.candidate);
    }

    get canSave(): boolean {
        const { username, displayName, bio } = this.changes;
        return (
            (username || displayName || bio) &&
            this.username.valid &&
            this.displayNameValid &&
            this.bioValid &&
            !this.saving &&
            !this.readOnly
        );
    }

    async save(): Promise<ProfileSaveOutcome> {
        if (!this.canSave) return { kind: "nothing" };
        const candidate = this.candidate;
        this.saving = true;
        try {
            const outcome = await this.#client.saveProfile(this.#saved(), candidate);
            this.errors = outcome.errors;
            this.#rejectedUsername = outcome.errors.username && candidate.username;
            // a field that saved follows the saved profile again, unless it was edited meanwhile; a
            // rejected one keeps its value
            const { profile } = outcome;
            if (
                profile.username === candidate.username &&
                this.username.value === candidate.username
            ) {
                this.username.reset();
            }
            if (
                profile.displayName === candidate.displayName &&
                this.displayName === candidate.displayName
            ) {
                this.#displayName = undefined;
            }
            if (profile.bio === candidate.bio && this.bio === candidate.bio) this.#bio = undefined;
            if (outcome.failure !== undefined) return { kind: "failed", reason: outcome.failure };
            return Object.keys(outcome.errors).length > 0
                ? { kind: "rejected" }
                : { kind: "saved" };
        } finally {
            this.saving = false;
        }
    }

    destroy(): void {
        this.username.destroy();
    }
}

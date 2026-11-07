<!-- Setting the name the user goes by in a community (You → Communities): a sheet with the name,
     Save, and, once they have one, going back to their display name. Saved as the web's profile
     saves it (logic/profile/communityName): a name the backend would turn down says why under the
     field. The host mounts it again for each community. -->
<script lang="ts">
    import { type CommunitySummary, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { saveCommunityName } from "@src/logic/profile/communityName";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";

    type Props = {
        open: boolean;
        community: CommunitySummary;
        /** The user's display name, which shows where they have no name of their own. */
        displayName: string;
        /** Saved, with what to toast. */
        onSaved: (message: string) => void;
        onClose: () => void;
    };

    let { open, community, displayName, onSaved, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const saved = $derived(community.membership.displayName);
    let name = $state(untrack(() => community.membership.displayName ?? ""));
    let saving = $state(false);
    // why the name couldn't be saved, translated
    let error = $state<string>();

    const changed = $derived(name.trim() !== (saved ?? ""));

    async function save(next: string | null) {
        if (saving) return;
        saving = true;
        error = undefined;
        try {
            const result = await saveCommunityName(client, community.id.communityId, next);
            switch (result.kind) {
                case "saved":
                    onSaved($_(next === null ? "native.you.communities.reset" : "native.you.communities.saved"));
                    break;
                case "rejected":
                    error = $_(result.message);
                    break;
                case "failed":
                    error = $_("native.you.communities.failed");
                    break;
            }
        } catch (err) {
            console.warn("Unable to save the community name", err);
            error = $_("native.you.communities.failed");
        } finally {
            saving = false;
        }
    }
</script>

<BottomSheet {open} {onClose} title={community.name}>
    <form
        class="form"
        onsubmit={(e) => {
            e.preventDefault();
            if (changed) void save(name);
        }}>
        <label class="field" class:warn={error !== undefined}>
            <input
                value={name}
                oninput={(e) => {
                    name = e.currentTarget.value;
                    error = undefined;
                }}
                placeholder={displayName}
                aria-label={$_("native.you.communities.nameLabel")}
                maxlength="25"
                autocomplete="off"
                enterkeyhint="done" />
        </label>
        <span class="note" class:warn={error !== undefined}>
            {error ?? $_("native.you.communities.nameHelp")}
        </span>
        <Button
            label={$_("save")}
            size="lg"
            fullWidth
            disabled={!changed || saving}
            onClick={() => void save(name)} />
        {#if saved !== undefined}
            <Button
                label={$_("native.you.communities.useDisplayName")}
                variant="ghost"
                size="lg"
                fullWidth
                disabled={saving}
                onClick={() => void save(null)} />
        {/if}
    </form>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .field {
        display: flex;
        align-items: center;
        height: 52px;
        padding: 0 var(--space-16);
        border-radius: 14px;
        background: var(--overlay-1);

        &.warn {
            box-shadow: inset 0 0 0 1.5px var(--status-warning);
        }

        &:focus-within:not(.warn) {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .note {
        padding: 0 4px;
        margin-top: calc(var(--space-4) * -1);
        font: var(--weight-medium) text-size(12.5px) / 1.35 var(--font-sans);
        color: var(--ink-4);

        &.warn {
            color: var(--status-warning);
        }
    }
</style>

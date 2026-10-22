<!-- Where the app's dialogs show (dialogs.ts): the one the URL's query opens (?profile, ?chit, ?hof,
     ?diamond), which closing drops from the URL, and the ones the app opened itself, newest on top,
     which a navigation closes first (closeModalStack). It also opens them as the old Home did: a
     name clicked in a message (`<profile-link>`) opens that user's card, and the `profile` and
     `upgrade` events open the profile and Diamond. -->
<script lang="ts">
    import { querystringStore, subscribe } from "@client";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam, withQueryStringFlag } from "@src/utils/urls";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import type { DialogStack } from "../../shell/dialogStack.svelte";
    import DialogScreen from "./DialogScreen.svelte";
    import {
        linkedDialog,
        linkedDialogParam,
        type LinkedDialog,
        type LocalDialog,
    } from "./dialogs";

    let { stack }: { stack: DialogStack<LocalDialog> } = $props();

    const linked = $derived(linkedDialog($querystringStore));

    function closeLinked(dialog: LinkedDialog) {
        navigate(removeQueryStringParam(linkedDialogParam(dialog)), "dismiss");
    }

    $effect(() => subscribe("closeModalStack", () => stack.closeAll()));
    $effect(() => subscribe("profile", () => navigate(withQueryStringFlag("profile"), "overlay")));
    $effect(() => subscribe("upgrade", () => navigate(withQueryStringFlag("diamond"), "overlay")));

    $effect(() => {
        const opened = (e: Event) => {
            const { userId, chatButton, inGlobalContext } = (
                e as CustomEvent<ProfileLinkClickedEvent>
            ).detail;
            stack.open({ kind: "user", userId, chatButton, inGlobalContext });
        };
        document.body.addEventListener("profile-clicked", opened);
        return () => document.body.removeEventListener("profile-clicked", opened);
    });
</script>

{#if linked !== undefined}
    <!-- another linked dialog is another screen -->
    {#key linked.kind}
        <DialogScreen dialog={linked} onClose={() => closeLinked(linked)} />
    {/key}
{/if}

{#each stack.items as dialog (dialog)}
    <DialogScreen {dialog} onClose={() => stack.close(dialog)} />
{/each}

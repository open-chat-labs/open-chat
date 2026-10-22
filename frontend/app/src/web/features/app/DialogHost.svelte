<!-- Where the app's dialogs show (dialogs.ts): the one the URL's query opens (?profile, ?chit, ?hof,
     ?diamond), which closing drops from the URL, and the ones the app opened itself, newest on top,
     which a navigation closes first (closeModalStack), as does Back. It also opens them as the old
     Home did: a name clicked in a message (`<profile-link>`) opens that user's card in place of
     the one open, and the `profile` and `upgrade` events open the profile and Diamond. -->
<script lang="ts">
    import { querystringStore, subscribe } from "@client";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import type { DialogStack } from "../../shell/dialogStack.svelte";
    import DialogScreen from "./DialogScreen.svelte";
    import {
        linkedDialog,
        linkedDialogParam,
        openLinkedDialog,
        type LinkedDialog,
        type LocalDialog,
    } from "./dialogs";

    let { stack }: { stack: DialogStack<LocalDialog> } = $props();

    const linked = $derived(linkedDialog($querystringStore));

    function closeLinked(dialog: LinkedDialog) {
        navigate(removeQueryStringParam(linkedDialogParam(dialog)), "dismiss");
    }

    // in place of the linked dialog showing, if any: from the profile, Diamond
    function openLinked(dialog: LinkedDialog) {
        const query = openLinkedDialog($querystringStore, dialog);
        if (query !== undefined) navigate(`${window.location.pathname}${query}`, "overlay");
    }

    $effect(() => subscribe("closeModalStack", () => stack.closeAll()));
    $effect(() => subscribe("profile", () => openLinked({ kind: "profile" })));
    $effect(() => subscribe("upgrade", () => openLinked({ kind: "diamond" })));

    // Back (or Forward) changes the page without navigate(), so it closes them here
    $effect(() => {
        const back = () => stack.closeAll();
        window.addEventListener("popstate", back);
        return () => window.removeEventListener("popstate", back);
    });

    $effect(() => {
        const opened = (e: Event) => {
            const { userId, chatButton, inGlobalContext } = (
                e as CustomEvent<ProfileLinkClickedEvent>
            ).detail;
            // one card at a time, as the old Home showed it
            const card: LocalDialog = { kind: "user", userId, chatButton, inGlobalContext };
            stack.replace(card, (open) => open.kind === "user");
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

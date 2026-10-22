<!-- Where the app's dialogs show (dialogs.ts): the one the URL's query opens (?profile, ?chit, ?hof,
     ?diamond), which closing drops from the URL, and the ones the app opened itself, newest on top,
     which a navigation closes first (closeModalStack), as does Back. It also opens them as the old
     Home did: a name clicked in a message (`<profile-link>`) opens that user's card in place of
     the one open (none for a bot), and the `profile` and `upgrade` events open the profile and
     Diamond. And it shows the chat's rules when sending needs them accepted first. -->
<script lang="ts">
    import {
        allUsersStore,
        captureRulesAcceptanceStore,
        OpenChat,
        querystringStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        subscribe,
    } from "@client";
    import { profileCard, profileCardShows } from "@src/logic/profile/profileCard";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { getContext } from "svelte";
    import { closeOnNavigation, type DialogStack } from "../../shell/dialogStack.svelte";
    import RulesDialog from "../conversation/RulesDialog.svelte";
    import DialogScreen from "./DialogScreen.svelte";
    import {
        linkedDialog,
        linkedDialogParam,
        openLinkedDialog,
        type LinkedDialog,
        type LocalDialog,
    } from "./dialogs";

    let { stack }: { stack: DialogStack<LocalDialog> } = $props();

    const client = getContext<OpenChat>("client");

    const linked = $derived(linkedDialog($querystringStore));

    function closeLinked(dialog: LinkedDialog) {
        navigate(removeQueryStringParam(linkedDialogParam(dialog)), "dismiss");
    }

    // in place of the linked dialog showing, if any: from the profile, Diamond
    function openLinked(dialog: LinkedDialog) {
        const query = openLinkedDialog($querystringStore, dialog);
        if (query !== undefined) navigate(`${window.location.pathname}${query}`, "overlay");
    }

    $effect(() => closeOnNavigation(stack));
    $effect(() => subscribe("profile", () => openLinked({ kind: "profile" })));
    $effect(() => subscribe("upgrade", () => openLinked({ kind: "diamond" })));

    $effect(() => {
        const opened = (e: Event) => {
            const card = profileCard((e as CustomEvent<ProfileLinkClickedEvent>).detail);
            // one card at a time, as the old Home showed it
            stack.replace({ kind: "user", ...card }, (open) => open.kind === "user");
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
    <!-- a bot has no card, checked as its user loads (as the old Home did) -->
    {#if dialog.kind !== "user" || profileCardShows($allUsersStore.get(dialog.userId))}
        <DialogScreen {dialog} onClose={() => stack.close(dialog)} />
    {/if}
{/each}

<!-- sending in a chat whose rules the reader hasn't accepted asks for them first; the client waits
     for the answer, so it isn't one of the dialogs a navigation closes -->
{#if $captureRulesAcceptanceStore !== undefined}
    <RulesDialog
        rules={client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)}
        answer={$captureRulesAcceptanceStore.resolve} />
{/if}

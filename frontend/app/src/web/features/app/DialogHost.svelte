<!-- Where the app's dialogs show (dialogs.ts): the one the URL's query opens (?profile, ?chit, ?hof,
     ?diamond), which closing drops from the URL, and the ones the app opened itself, newest on top,
     which a navigation closes first (closeModalStack), as does Back. It also opens them as the old
     Home did: a name clicked in a message (`<profile-link>`) opens that user's card in place of
     the one open (none for a bot), and the `profile` and `upgrade` events open the profile and
     Diamond. And it shows the chat's rules when sending needs them accepted first, and what the
     client's app events ask to show (not found, no access …). -->
<script lang="ts">
    import {
        allUsersStore,
        captureRulesAcceptanceStore,
        OpenChat,
        pinNumberResolverStore,
        querystringStore,
        selectedChatIdStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
        subscribe,
    } from "@client";
    import type { AppEventDialog } from "@src/logic/appEvents/appEvents";
    import { profileCard, profileCardShows } from "@src/logic/profile/profileCard";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { getContext } from "svelte";
    import { closeOnNavigation, type DialogStack } from "../../shell/dialogStack.svelte";
    import RulesDialog from "../conversation/RulesDialog.svelte";
    import PinPromptHost from "../pin/PinPromptHost.svelte";
    import { declineOnChatChange, declinePrompt, waitingPrompt } from "../pin/pinPrompt";
    import AppEventDialogs from "./AppEventDialogs.svelte";
    import DialogScreen from "./DialogScreen.svelte";
    import {
        linkedDialog,
        linkedDialogParam,
        openLinkedDialog,
        type LinkedDialog,
        type LocalDialog,
    } from "./dialogs";

    interface Props {
        stack: DialogStack<LocalDialog>;
        // not on the stack: a navigation doesn't close it, closing it leaves the page
        appDialog: AppEventDialog | undefined;
        onCloseAppDialog: () => void;
    }

    let { stack, appDialog, onCloseAppDialog }: Props = $props();

    const client = getContext<OpenChat>("client");

    const linked = $derived(linkedDialog($querystringStore));

    function closeLinked(dialog: LinkedDialog) {
        navigate(removeQueryStringParam(linkedDialogParam(dialog)), "dismiss");
    }

    // in place of the linked dialog showing, if any: from the profile, Diamond. From the URL as it
    // is: the store's query is decoded, so its values can't be written back
    function openLinked(dialog: LinkedDialog) {
        const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
        if (query !== undefined) navigate(`${window.location.pathname}${query}`, "overlay");
    }

    // what the client is waiting on to send: the rules, then the PIN
    const prompt = $derived(waitingPrompt($captureRulesAcceptanceStore, $pinNumberResolverStore));

    // a navigation doesn't close them, but another chat declines them (pinPrompt.ts)
    $effect(() => {
        const waiting = prompt;
        if (waiting.kind === "none") return;
        return declineOnChatChange(selectedChatIdStore, () => declinePrompt(waiting));
    });

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
    {#if profileCardShows($allUsersStore.get(dialog.userId))}
        <DialogScreen {dialog} onClose={() => stack.close(dialog)} />
    {/if}
{/each}

<!-- sending in a chat whose rules the reader hasn't accepted asks for them first, and a transfer
     that needs the PIN asks for it; the client waits for the answer, so neither is one of the
     dialogs a navigation closes (another chat declines them, above) -->
{#if prompt.kind === "rules"}
    <RulesDialog
        rules={client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)}
        answer={prompt.request.resolve} />
{:else if prompt.kind === "pin"}
    {#key prompt.request}
        <PinPromptHost request={prompt.request} />
    {/key}
{/if}

<!-- TODO(phase 4, 4a): suspending a user (platform moderators) has no dialog yet; GAPS.md -->
{#if appDialog !== undefined && appDialog.kind !== "suspending"}
    <AppEventDialogs dialog={appDialog} onClose={onCloseAppDialog} />
{/if}

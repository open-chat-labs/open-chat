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
    import SuspendUserDialog from "../user/SuspendUserDialog.svelte";
    import AppEventDialogs from "./AppEventDialogs.svelte";
    import DialogScreen from "./DialogScreen.svelte";
    import { chitTurnedOff, openLinked, urlChanged } from "./linkedDialogs.svelte";
    import { disableChit } from "@src/stores/settings";
    import { screenLoader } from "./screens";
    import {
        builtDialogScreens,
        linkedDialog,
        linkedDialogParam,
        shownLinkedDialog,
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

    // not the CHIT dialog while CHIT is off: it doesn't open, and closes if CHIT is turned off
    const linked = $derived(shownLinkedDialog(linkedDialog($querystringStore), $disableChit));

    // a linked dialog replaced by another kind while it's still showing hands its backdrop over,
    // so only the next dialog animates in: Diamond from the profile (openLinked, which plays no
    // exit), browser or hardware Back from Diamond (gone at once, with no exit). Not once it has
    // played its own exit (closeLinked: its backdrop has faded), whatever opens next. Followed in
    // the store's subscription, as the URL changes, before the screens render; the next screen
    // claims it once, as it opens
    let handedOffTo: LinkedDialog["kind"] | undefined;
    let exited = false;

    $effect(() => {
        let shown: LinkedDialog["kind"] | undefined;
        return querystringStore.subscribe((query) => {
            urlChanged(`${window.location.pathname}${window.location.search}`);
            const kind = linkedDialog(query)?.kind;
            if (kind === shown) return;
            handedOffTo = shown !== undefined && kind !== undefined && !exited ? kind : undefined;
            exited = false;
            shown = kind;
        });
    });

    function claimInPlace(kind: LinkedDialog["kind"]): boolean {
        const inPlace = handedOffTo === kind;
        handedOffTo = undefined;
        return inPlace;
    }

    // once the dialog has played its exit
    function closeLinked(dialog: LinkedDialog) {
        exited = true;
        navigate(removeQueryStringParam(linkedDialogParam(dialog)), "dismiss");
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

    // a back arrow to a CHIT dialog is offered only while CHIT is on (linkedDialogs.svelte.ts)
    $effect(() => disableChit.subscribe(chitTurnedOff, undefined));

    // the built dialogs' code, loaded once the app is idle, so a dialog opens at once rather than
    // after a spinner the first time (it's still left out of the app's first download). Not while
    // offline; and one that fails ahead loads again when it's opened
    $effect(() => {
        const prefetch = () => {
            if (!navigator.onLine) return;
            builtDialogScreens().forEach((load) => screenLoader(load).prefetch());
        };
        if ("requestIdleCallback" in window) {
            const id = requestIdleCallback(prefetch, { timeout: 5000 });
            return () => cancelIdleCallback(id);
        }
        const id = setTimeout(prefetch, 2000);
        return () => clearTimeout(id);
    });
    $effect(() => subscribe("profile", () => openLinked({ kind: "profile" })));
    $effect(() => subscribe("upgrade", () => openLinked({ kind: "diamond" })));
    // the old UI's way to a daily puzzle (a daily result message's Play …)
    $effect(() =>
        subscribe("dailyPuzzle", ({ gameId }) => {
            if (!disableChit.value) openLinked({ kind: "puzzle", gameId });
        }),
    );
    // the old UI's way to the daily claim (the prize message's CHIT link …)
    $effect(() =>
        subscribe("claimDailyChit", () => {
            if (!disableChit.value) openLinked({ kind: "chit" });
        }),
    );

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
        <DialogScreen
            dialog={linked}
            claimInPlace={() => claimInPlace(linked.kind)}
            onClose={() => closeLinked(linked)}
            dialogs={stack} />
    {/key}
{/if}

{#each stack.items as dialog (dialog)}
    <!-- a bot has no card, checked as its user loads (as the old Home did) -->
    {#if dialog.kind !== "user" || profileCardShows($allUsersStore.get(dialog.userId))}
        <DialogScreen {dialog} onClose={() => stack.close(dialog)} dialogs={stack} />
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

{#if appDialog?.kind === "suspending"}
    <SuspendUserDialog userId={appDialog.userId} onClose={onCloseAppDialog} />
{:else if appDialog !== undefined}
    <AppEventDialogs dialog={appDialog} onClose={onCloseAppDialog} />
{/if}

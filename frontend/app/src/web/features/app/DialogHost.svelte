<!-- The app's local dialogs, mounted in one place (shell/dialogHost.svelte.ts says which is open):
     the client's prompts (rules acceptance), the bus events' dialogs, a profile link's UserDialog,
     and the dialogs people link to by query param. -->
<script lang="ts">
    import {
        allUsersStore,
        captureRulesAcceptanceStore,
        OpenChat,
        publish,
        querystringStore,
        selectedChatRulesStore,
        selectedCommunityRulesStore,
    } from "@client";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import UserDialog from "@openchat/ui/src/features/components/UserDialog.svelte";
    import { subscribeAppEvents } from "@src/logic/appEvents/appEvents";
    import { profileCard, profileCardChat } from "@src/logic/profile/profileCard";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { getContext } from "svelte";
    import { dialogHostKey, type DialogHost } from "../../shell/dialogHost.svelte";
    import RulesDialog from "../conversation/RulesDialog.svelte";
    import AppEventDialog from "./AppEventDialogs.svelte";
    import Placeholder from "./Placeholder.svelte";

    const client = getContext<OpenChat>("client");
    const host = getContext<DialogHost>(dialogHostKey);

    // the client's app-wide events, as every tree handles them (app/src/logic/appEvents)
    $effect(() =>
        subscribeAppEvents(client, (outcome) => {
            if (outcome.kind === "show") {
                host.show({ kind: "app_event", dialog: outcome.dialog });
            } else {
                if (outcome.closeDialogs) publish("closeModalStack");
                navigate(outcome.path);
            }
        }),
    );

    // <profile-link> raises profile-clicked (web-components/profileLink.ts)
    $effect(() => {
        const clicked = (ev: Event) =>
            host.show({
                kind: "user",
                clicked: (ev as CustomEvent<ProfileLinkClickedEvent>).detail,
            });
        document.body.addEventListener("profile-clicked", clicked);
        return () => document.body.removeEventListener("profile-clicked", clicked);
    });

    // a navigation gives up the rules prompt, as closing it would: accepting it after the chat
    // changed would accept the new chat's rules
    $effect(() => {
        const prompt = $captureRulesAcceptanceStore;
        if (prompt !== undefined) return host.holdPrompt(() => prompt.resolve(false));
    });

    const open = $derived(host.open);
    const card = $derived(
        open?.kind === "user"
            ? profileCard(open.clicked, $allUsersStore.get(open.clicked.userId))
            : undefined,
    );

    // Dialogs people link to are query params over whatever page is open (ROUTES.md)
    const profileOpen = $derived($querystringStore.has("profile"));
</script>

<!-- sending in a chat whose rules the reader hasn't accepted asks for them first -->
{#if $captureRulesAcceptanceStore !== undefined}
    <RulesDialog
        rules={client.combineRulesText($selectedChatRulesStore, $selectedCommunityRulesStore)}
        answer={$captureRulesAcceptanceStore.resolve} />
{/if}

<!-- TODO(phase 4, 4a): suspending a user (platform moderators) has no dialog yet; GAPS.md -->
{#if open?.kind === "app_event" && open.dialog.kind !== "suspending"}
    <AppEventDialog dialog={open.dialog} onClose={() => host.dismiss()} />
{/if}

{#if card !== undefined}
    <!-- TODO(phase 4, 4a): the user adapter fills this in (name, avatar, facts, bio, block) -->
    <UserDialog
        title={$allUsersStore.get(card.userId)?.username ?? ""}
        facts={[]}
        onMessage={card.chatButton
            ? () => {
                  publish("chatWith", profileCardChat(card));
                  host.dismiss();
              }
            : undefined}
        onCancel={() => host.dismiss()} />
{/if}

{#if profileOpen}
    <!-- TODO(phase 8): ProfileDialog -->
    <DialogShell
        title="Profile"
        onClose={() => navigate(removeQueryStringParam("profile"), "dismiss")}>
        <Placeholder title="Profile" detail="ProfileDialog (phase 8)" />
    </DialogShell>
{/if}

<!-- Someone's profile, from a member's row (native plan 10: "tapping a member opens their profile
     sheet"): a bottom sheet with their avatar, name and @username, About (bio, member since, CHIT
     earned: the web's user card's facts, filled in as their profile loads, logic/profile's
     ProfileCardData), and the web's user card's actions: Message, which opens your DM with them
     (not on your own), and Block or Unblock where the card offers it here (ProfileCardBlock: in the
     group, for a role that may block; in a channel, its community's). -->
<script lang="ts" module>
    /** Whose profile: their name where it was opened, and whether it's yours. */
    export type ProfilePerson = { userId: string; name: string; isMe: boolean };
</script>

<script lang="ts">
    import {
        allUsersStore,
        toMonthYearString,
        userBadges,
        type BlockContext,
        type OpenChat,
    } from "@client";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { senderColor } from "@src/logic/conversation/messageRow";
    import { ProfileCardBlock, ProfileCardData } from "@src/logic/profile/profileCardData.svelte";
    import { disableChit } from "@src/stores/settings";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import FactRow from "./FactRow.svelte";
    import TextRow from "./TextRow.svelte";

    type Props = {
        /** None keeps the sheet closed. */
        person: ProfilePerson | undefined;
        onMessage: (userId: string) => void;
        /** Blocks or unblocks them where the sheet was opened; the sheet closes first. */
        onBlock: (person: ProfilePerson, blocking: boolean, context: BlockContext) => void;
        onClose: () => void;
    };

    let { person, onMessage, onBlock, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the last person shown stays while the sheet slides away
    let lastShown: ProfilePerson | undefined;
    const shown = $derived.by(() => {
        if (person !== undefined) lastShown = person;
        return lastShown;
    });
    const shownId = $derived(shown?.userId);

    // loaded once per person shown, the sheet closing if it can't be
    const card = $derived.by(() => {
        const id = shownId;
        return id === undefined ? undefined : untrack(() => new ProfileCardData(client, id, onClose));
    });

    // what it offers to block or unblock, in the chat it's opened in (the web card's)
    const cardBlock = $derived.by(() => {
        const id = shownId;
        return id === undefined ? undefined : untrack(() => new ProfileCardBlock(client, id, false));
    });
    const block = $derived(cardBlock?.current);

    const user = $derived(shownId === undefined ? undefined : $allUsersStore.get(shownId));
    const isBot = $derived(user?.kind === "bot");

    const profile = $derived(card?.profile);
    const memberSince = $derived(
        profile !== undefined && profile.created > 0n
            ? toMonthYearString(new Date(Number(profile.created)), $locale ?? "en")
            : "",
    );
    const chit = $derived(
        card?.user === undefined
            ? undefined
            : userBadges(
                  {
                      diamondStatus: card.user.diamondStatus,
                      streak: card.user.streak,
                      chitEarned: card.user.totalChitEarned,
                  },
                  $disableChit,
              ).chit,
    );
</script>

<BottomSheet open={person !== undefined} {onClose} label={shown?.name ?? ""}>
    {#if shown !== undefined && shownId !== undefined}
        <div class="profile">
            <div class="identity">
                {#if user?.blobUrl !== undefined}
                    <img class="photo" src={user.blobUrl} alt="" />
                {:else}
                    <Avatar size={72} color={senderColor(shownId)} />
                {/if}
                <span class="name">{shown.name}</span>
                {#if user !== undefined}<span class="handle">@{user.username}</span>{/if}
            </div>

            {#if profile !== undefined && (profile.bio !== "" || memberSince !== "" || chit !== undefined)}
                <SettingsGroup label={$_("native.you.about")}>
                    {#if profile.bio !== ""}
                        <TextRow text={profile.bio} />
                    {/if}
                    {#if memberSince !== ""}
                        <FactRow label={$_("native.you.memberSince")} value={memberSince} />
                    {/if}
                    {#if chit !== undefined}
                        <FactRow
                            label={$_("native.details.chitEarned")}
                            value={chit.earned.toLocaleString($locale ?? "en")}
                            mono />
                    {/if}
                </SettingsGroup>
            {/if}

            {#if !shown.isMe && !isBot}
                <Button
                    label={$_("native.details.members.message")}
                    icon="chat"
                    size="lg"
                    fullWidth
                    onClick={() => shownId !== undefined && onMessage(shownId)} />
            {/if}

            {#if block !== undefined && block.kind !== "none" && !isBot}
                {@const context = block.context}
                {@const blocking = block.kind === "block"}
                <SettingsGroup>
                    <SettingsAction
                        icon="ban"
                        label={$_(
                            blocking ? "native.conversation.menu.block" : "native.details.unblock",
                            { values: { name: shown.name } },
                        )}
                        danger={blocking}
                        onClick={() => onBlock(shown, blocking, context)} />
                </SettingsGroup>
            {/if}
        </div>
    {/if}
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .profile {
        display: flex;
        flex-direction: column;
        gap: 20px;
        // clear of the sheet's handle above the avatar
        padding: var(--space-18) var(--space-16) calc(var(--safe-bottom) + 16px);
    }

    .identity {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
    }

    .photo {
        width: 72px;
        height: 72px;
        border-radius: var(--radius-circle);
        object-fit: cover;
    }

    .name {
        margin-top: 6px;
        font: 800 text-size(20px) / 1.2 var(--font-sans);
        overflow-wrap: anywhere;
    }

    .handle {
        font: var(--weight-medium) text-size(13.5px) / 1.2 var(--font-mono);
        color: var(--ink-4);
        overflow-wrap: anywhere;
    }
</style>

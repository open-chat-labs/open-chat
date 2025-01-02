<script lang="ts">
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { AvatarSize, userStore } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import { i18nKey } from "../../../i18n/i18n";
    import Badges from "./Badges.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import { referredUsersOpen } from "../../../stores/settings";

    const client = getContext<OpenChat>("client");

    export let referrals: Set<string>;

    function showUserProfile(ev: Event, userId: string) {
        ev.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: {
                    userId,
                    chatButton: false,
                    inGlobalContext: true,
                },
                bubbles: true,
            }),
        );
    }
</script>

{#if referrals.size > 0}
    <CollapsibleCard
        on:toggle={referredUsersOpen.toggle}
        open={$referredUsersOpen}
        headerText={i18nKey("invite.referredUsers")}>
        <div class="referrals">
            {#each referrals as referral}
                {@const u = $userStore.get(referral)}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div class="referral" on:click={(ev) => showUserProfile(ev, referral)}>
                    <div>
                        <Avatar
                            url={client.userAvatarUrl(u)}
                            userId={referral}
                            size={AvatarSize.Small} />
                    </div>
                    <LinkButton on:click={(ev) => showUserProfile(ev, referral)}>
                        {client.displayName(u)}
                        <Badges uniquePerson={u?.isUniquePerson} diamondStatus={u?.diamondStatus} />
                    </LinkButton>
                </div>
            {/each}
        </div>
    </CollapsibleCard>
{/if}

<style lang="scss">
    .referrals {
        display: flex;
        flex-direction: column;
        gap: $sp3;
    }

    .referral {
        cursor: pointer;
        align-items: center;
        display: flex;
        gap: $sp3;
    }
</style>

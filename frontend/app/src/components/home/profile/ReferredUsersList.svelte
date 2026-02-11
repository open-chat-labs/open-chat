<script lang="ts">
    import type { OpenChat, ReadonlySet } from "openchat-client";
    import { AvatarSize, allUsersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { referredUsersOpen } from "../../../stores/settings";
    import Avatar from "../../Avatar.svelte";
    import CollapsibleCard from "../../CollapsibleCard.svelte";
    import LinkButton from "../../LinkButton.svelte";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import Badges from "./Badges.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        referrals: ReadonlySet<string>;
    }

    let { referrals }: Props = $props();

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
        onToggle={referredUsersOpen.toggle}
        open={$referredUsersOpen}
        headerText={i18nKey("invite.referredUsers")}>
        <div class="referrals">
            {#each referrals as referral}
                {@const u = $allUsersStore.get(referral)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="referral" onclick={(ev) => showUserProfile(ev, referral)}>
                    <div>
                        <Avatar
                            url={client.userAvatarUrl(u)}
                            userId={referral}
                            size={AvatarSize.Small} />
                    </div>
                    <LinkButton onClick={(ev) => showUserProfile(ev, referral)}>
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

<script lang="ts">
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { AvatarSize } from "openchat-client";
    import Avatar from "../../Avatar.svelte";
    import type { ProfileLinkClickedEvent } from "../../web-components/profileLink";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Badges from "./Badges.svelte";
    import LinkButton from "../../LinkButton.svelte";

    const client = getContext<OpenChat>("client");

    export let referrals: Set<string>;

    $: userStore = client.userStore;

    function showUserProfile(ev: Event, userId: string) {
        ev.target?.dispatchEvent(
            new CustomEvent<ProfileLinkClickedEvent>("profile-clicked", {
                detail: { userId, chatButton: false, inGlobalContext: true },
                bubbles: true,
            }),
        );
    }
</script>

{#if referrals.size > 0}
    <div class="referrals-section">
        <h4><Translatable resourceKey={i18nKey("invitedUsers")} /></h4>
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
    </div>
{/if}

<style lang="scss">
    .referrals-section {
        margin-top: $sp3;

        .referrals {
            display: flex;
            flex-direction: column;
            gap: $sp3;
            margin-top: $sp4;
            width: fit-content;

            .referral {
                cursor: pointer;
                align-items: center;
                display: flex;
                gap: $sp3;
            }
        }
    }
</style>

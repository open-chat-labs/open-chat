<script lang="ts">
    import { subscribe, type PublicProfile } from "openchat-client";
    import { onMount } from "svelte";
    import SlidingPage from "./SlidingPage.svelte";
    import About from "./user_profile/About.svelte";
    import BotConfig from "./user_profile/BotConfig.svelte";
    import ChatsAndVideo from "./user_profile/ChatsAndVideo.svelte";
    import ClearCache from "./user_profile/ClearCache.svelte";
    import DeleteAccount from "./user_profile/DeleteAccount.svelte";
    import ProfileSettings from "./user_profile/ProfileSettings.svelte";
    import Share from "./user_profile/Share.svelte";

    type SlidingModalType =
        | { kind: "user_profile_chats_and_video" }
        | { kind: "user_profile_share" }
        | { kind: "user_profile_about" }
        | { kind: "user_profile_bot_config" }
        | { kind: "user_profile_delete_account" }
        | { kind: "user_profile_cache_management" }
        | { kind: "user_profile_settings"; profile: PublicProfile }
        | { kind: "none" };

    let modalType = $state<SlidingModalType>({ kind: "none" });

    onMount(() => {
        const unsubs = [
            subscribe(
                "userProfileSettings",
                (profile) => (modalType = { kind: "user_profile_settings", profile }),
            ),
            subscribe("userProfileShare", () => (modalType = { kind: "user_profile_share" })),
            subscribe(
                "userProfileDeleteAccount",
                () => (modalType = { kind: "user_profile_delete_account" }),
            ),
            subscribe(
                "userProfileBotConfig",
                () => (modalType = { kind: "user_profile_bot_config" }),
            ),
            subscribe(
                "userProfileCacheManagement",
                () => (modalType = { kind: "user_profile_cache_management" }),
            ),
            subscribe("userProfileAbout", () => (modalType = { kind: "user_profile_about" })),
            subscribe("closeModalPage", () => (modalType = { kind: "none" })),
            subscribe(
                "userProfileChatsAndVideo",
                () => (modalType = { kind: "user_profile_chats_and_video" }),
            ),
        ];
        return () => {
            unsubs.forEach((u) => u());
        };
    });
</script>

{#if modalType.kind === "user_profile_chats_and_video"}
    <SlidingPage>
        <ChatsAndVideo />
    </SlidingPage>
{:else if modalType.kind === "user_profile_share"}
    <SlidingPage>
        <Share />
    </SlidingPage>
{:else if modalType.kind === "user_profile_delete_account"}
    <SlidingPage>
        <DeleteAccount />
    </SlidingPage>
{:else if modalType.kind === "user_profile_about"}
    <SlidingPage>
        <About />
    </SlidingPage>
{:else if modalType.kind === "user_profile_cache_management"}
    <SlidingPage>
        <ClearCache />
    </SlidingPage>
{:else if modalType.kind === "user_profile_bot_config"}
    <SlidingPage>
        <BotConfig />
    </SlidingPage>
{:else if modalType.kind === "user_profile_settings"}
    <SlidingPage>
        <ProfileSettings profile={modalType.profile} />
    </SlidingPage>
{/if}

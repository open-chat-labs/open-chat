<script lang="ts">
    import ArrowUpBoldOutline from "svelte-material-icons/ArrowUpBoldOutline.svelte";
    import ArrowDownBoldOutline from "svelte-material-icons/ArrowDownBoldOutline.svelte";
    import MicrophoneOff from "svelte-material-icons/MicrophoneOff.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import type { UserSummary, VideoCallPresence } from "openchat-shared";
    import User from "../../home/groupdetails/User.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let participant: UserSummary;
    export let presence: VideoCallPresence;
    export let isOwner: boolean;

    /* 

    hidden users 
    - promote to presenter

    presenters 
    - change to hidden 
    - mute user (switch off their mic)
    */

    function promote() {
        console.log("Promote this user to presenter");
    }

    function demote() {
        console.log("demote this user to hidden");
    }

    function mute() {
        console.log("mute this user's mic");
    }
</script>

<User user={participant}>
    {#if isOwner}
        <span class="menu">
            <MenuIcon position={"bottom"} align={"end"}>
                <span slot="icon">
                    <HoverIcon>
                        <ChevronDown size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        {#if presence === "hidden"}
                            <MenuItem on:click={() => promote()}>
                                <ArrowUpBoldOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("videoCall.promoteToPresenter")} />
                                </div>
                            </MenuItem>
                        {/if}
                        {#if presence === "default"}
                            <MenuItem on:click={() => demote()}>
                                <ArrowDownBoldOutline
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("videoCall.demoteToHidden")} />
                                </div>
                            </MenuItem>
                            <MenuItem on:click={() => mute()}>
                                <MicrophoneOff
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"}
                                    slot="icon" />
                                <div slot="text">
                                    <Translatable
                                        resourceKey={i18nKey("videoCall.muteParticipant")} />
                                </div>
                            </MenuItem>
                        {/if}
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    {/if}
</User>

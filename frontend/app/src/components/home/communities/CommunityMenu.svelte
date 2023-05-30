<script lang="ts">
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import LocationExit from "svelte-material-icons/LocationExit.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Menu from "../../Menu.svelte";
    import { _ } from "svelte-i18n";
    import MenuItem from "../../MenuItem.svelte";
    import type { Community } from "openchat-client";
    import AreYouSure from "../../AreYouSure.svelte";
    import { createEventDispatcher } from "svelte";
    import { dummyCommunities, myCommunities } from "../../../stores/community";

    export let community: Community;

    const dispatch = createEventDispatcher();

    let confirm: ConfirmAction | undefined = undefined;
    let canEdit = true; //TODO this need to be based on permissions
    let canLeave = true; //TODO this need to be based on permissions
    let canDelete = true; //TODO this need to be based on permissions

    const confirmMsgs = {
        leave: "communities.leaveMessage",
        delete: "communities.deleteMessage",
    };

    type ConfirmAction = ConfirmLeave | ConfirmDelete;

    interface ConfirmLeave {
        kind: "leave";
    }

    interface ConfirmDelete {
        kind: "delete";
        doubleCheck: { challenge: string; response: string };
    }

    function leaveCommunity() {
        confirm = { kind: "leave" };
    }

    function deleteCommunity() {
        confirm = {
            kind: "delete",
            doubleCheck: {
                challenge: $_("typeGroupName", { values: { name: community.name } }),
                response: community.name,
            },
        };
    }

    function editCommunity() {
        dispatch("editCommunity", community);
    }

    function browseChannels() {
        dispatch("browseChannels", community);
    }

    async function doPostConfirm(yes: boolean) {
        if (yes) {
            switch (confirm?.kind) {
                case "delete":
                    return doDelete();
                case "leave":
                    return doLeave();
            }
        }
        return Promise.resolve();
    }

    function doDelete() {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                console.log("TODO - delete community", community);
                myCommunities.update((communities) => {
                    return communities.filter((c) => c.id !== community.id);
                });
                dummyCommunities.update((communities) => {
                    return communities.filter((c) => c.id !== community.id);
                });
                resolve();
            }, 2000);
        });
    }

    function doLeave() {
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                console.log("TODO - leave community", community);
                myCommunities.update((communities) => {
                    return communities.filter((c) => c.id !== community.id);
                });
                resolve();
            }, 2000);
        });
    }
</script>

{#if confirm}
    <AreYouSure
        doubleCheck={confirm.kind === "delete" ? confirm.doubleCheck : undefined}
        message={$_(confirmMsgs[confirm.kind])}
        title={$_("areYouSure")}
        action={(res) => doPostConfirm(res).finally(() => (confirm = undefined))} />
{/if}

<MenuIcon position="bottom" align="end">
    <span slot="icon">
        <HoverIcon>
            <Kebab size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <span slot="menu">
        <Menu>
            {#if canEdit}
                <MenuItem on:click={editCommunity}>
                    <PencilOutline
                        size={$iconSize}
                        color={"var(--icon-inverted-txt)"}
                        slot="icon" />
                    <div slot="text">{$_("communities.edit")}</div>
                </MenuItem>
            {/if}
            <MenuItem on:click={browseChannels}>
                <Pound size={$iconSize} color={"var(--icon-inverted-txt)"} slot="icon" />
                <div slot="text">{$_("communities.browseChannels")}</div>
            </MenuItem>
            <MenuItem separator />
            {#if canDelete}
                <MenuItem warning on:click={deleteCommunity}>
                    <DeleteOutline size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                    <div slot="text">{$_("communities.delete")}</div>
                </MenuItem>
            {/if}
            {#if canLeave}
                <MenuItem warning on:click={leaveCommunity}>
                    <LocationExit size={$iconSize} color={"var(--menu-warn)"} slot="icon" />
                    <div slot="text">{$_("communities.leave")}</div>
                </MenuItem>
            {/if}
        </Menu>
    </span>
</MenuIcon>

<style type="text/scss">
</style>

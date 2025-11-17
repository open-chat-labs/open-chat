<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, Chip, Container } from "component-lib";
    import {
        ROLE_ADMIN,
        ROLE_MEMBER,
        ROLE_MODERATOR,
        ROLE_NONE,
        ROLE_OWNER,
        type ChatPermissionRole,
        type ChatPermissions,
        type MessagePermissions,
        type PermissionsByRole,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Translatable from "../../Translatable.svelte";
    import GroupPermissionsPartitionViewer from "../GroupPermissionsPartitionViewer.svelte";

    interface Props {
        permissions: ChatPermissions;
        isPublic: boolean;
        isCommunityPublic: boolean;
        isChannel: boolean;
        embeddedContent: boolean;
    }

    let { permissions, isPublic, isCommunityPublic, isChannel, embeddedContent }: Props = $props();

    let items = embeddedContent
        ? [i18nKey("permissions.general")]
        : [
              i18nKey("permissions.general"),
              i18nKey("permissions.message"),
              i18nKey("permissions.thread"),
          ];
    let selectedTab = $state(items[0].key);
    let threadPartition = $derived(
        partitionMessagePermissions(
            permissions.threadPermissions ?? permissions.messagePermissions,
            true,
        ),
    );
    let messagePartition = $derived(
        partitionMessagePermissions(permissions.messagePermissions, false),
    );
    let generalPartition = $derived(
        partitionPermissions(
            {
                changeRoles: permissions.changeRoles,
                updateGroup: permissions.updateGroup,
                inviteUsers: permissions.inviteUsers,
                addMembers: permissions.addMembers,
                removeMembers: permissions.removeMembers,
                deleteMessages: permissions.deleteMessages,
                startVideoCall: permissions.startVideoCall,
                pinMessages: permissions.pinMessages,
                reactToMessages: permissions.reactToMessages,
                mentionAllMembers: permissions.mentionAllMembers,
            },
            "",
        ),
    );

    type PermissionsEntry = [keyof ChatPermissions, ChatPermissionRole];

    function partitionMessagePermissions(
        mps: MessagePermissions,
        thread: boolean,
    ): PermissionsByRole {
        let permissions: Record<string, ChatPermissionRole> = {
            text: mps.text ?? mps.default,
            image: mps.image ?? mps.default,
            video: mps.video ?? mps.default,
            audio: mps.audio ?? mps.default,
            file: mps.file ?? mps.default,
            poll: mps.poll ?? mps.default,
            crypto: mps.crypto ?? mps.default,
            giphy: mps.giphy ?? mps.default,
            memeFighter: mps.memeFighter ?? mps.default,
            p2pSwap: mps.p2pSwap ?? mps.default,
        };

        if (!thread) {
            permissions = { ...permissions, prize: mps.prize ?? mps.default };
        }

        return partitionPermissions(
            permissions,
            thread ? "threadPermissions." : "messagePermissions.",
        );
    }

    function filterPermissions([key, _]: PermissionsEntry): boolean {
        if (isPublic && key === "inviteUsers") {
            return false;
        }
        if (key === "addMembers" && (!isChannel || isCommunityPublic)) {
            return false;
        }
        return true;
    }

    function partitionPermissions(
        permissions: Record<string, ChatPermissionRole>,
        translationExt: string,
    ): PermissionsByRole {
        return (Object.entries(permissions) as PermissionsEntry[]).filter(filterPermissions).reduce(
            (dict: PermissionsByRole, [key, val]) => {
                const text = $_(
                    `permissions.${translationExt}${key}`,
                    key === "mentionAllMembers" ? { values: { mention: "@everyone" } } : {},
                );

                dict[val].add(text);
                return dict;
            },
            {
                [ROLE_OWNER]: new Set(),
                [ROLE_ADMIN]: new Set(),
                [ROLE_MODERATOR]: new Set(),
                [ROLE_MEMBER]: new Set(),
                [ROLE_NONE]: new Set(),
            } as PermissionsByRole,
        );
    }
</script>

{#snippet viewChip(tab: string)}
    <Chip
        fill
        onClick={() => (selectedTab = tab)}
        mode={selectedTab === tab ? "rounded" : "unselected"}>
        <Translatable resourceKey={i18nKey(tab)}></Translatable>
    </Chip>
{/snippet}

<Container gap={"xl"} direction={"vertical"}>
    <Body colour={"textSecondary"} fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("Permissions")}></Translatable>
    </Body>

    <Container gap={"sm"}>
        {@render viewChip("permissions.general")}
        {@render viewChip("permissions.message")}
        {@render viewChip("permissions.thread")}
    </Container>

    {#if selectedTab === "permissions.general"}
        <GroupPermissionsPartitionViewer partition={generalPartition} />
    {:else if selectedTab === "permissions.message"}
        <GroupPermissionsPartitionViewer partition={messagePartition} />
    {:else if selectedTab === "permissions.thread"}
        <GroupPermissionsPartitionViewer partition={threadPartition} />
    {/if}
</Container>

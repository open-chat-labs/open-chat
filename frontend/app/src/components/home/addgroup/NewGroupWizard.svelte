<script lang="ts">
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import GroupDetails from "./GroupDetails.svelte";
    import GroupVisibility from "./GroupVisibility.svelte";
    import Rules from "../groupdetails/Rules.svelte";
    import GroupPermissionsEditor from "../GroupPermissionsEditor.svelte";
    import ChooseMembers from "./ChooseMembers.svelte";
    import { CandidateGroupChat, defaultGroupRules } from "openchat-client";

    let allowBack = false;
    let allowForwards = false;
    let candidateGroup: CandidateGroupChat = defaultCandidateGroup();
    let busy = false;
    let bodyElement: HTMLDivElement;
    let step = 0;
    $: left = step * 550;

    function defaultCandidateGroup(): CandidateGroupChat {
        return {
            name: "",
            description: "",
            historyVisible: true,
            isPublic: false,
            members: [],
            permissions: {
                changePermissions: "admins",
                changeRoles: "admins",
                addMembers: "admins",
                removeMembers: "admins",
                blockUsers: "admins",
                deleteMessages: "admins",
                updateGroup: "admins",
                pinMessages: "admins",
                inviteUsers: "admins",
                createPolls: "members",
                sendMessages: "members",
                reactToMessages: "members",
                replyInThread: "members",
            },
            rules: {
                text: defaultGroupRules,
                enabled: false,
            },
        };
    }
</script>

<ModalContent closeIcon on:close>
    <div class="header" slot="header">{$_("createNewGroup")}</div>
    <div class="wrapper" bind:this={bodyElement} slot="body">
        <div class="sections" style={`left: -${left}px`}>
            <div class="details">
                <GroupDetails bind:candidateGroup />
            </div>

            <div class="visibility">
                <GroupVisibility bind:candidateGroup />
            </div>

            <div class="rules">
                <Rules bind:rules={candidateGroup.rules} />
            </div>

            <div class="permissions">
                <GroupPermissionsEditor
                    bind:permissions={candidateGroup.permissions}
                    isPublic={candidateGroup.isPublic} />
            </div>
        </div>
    </div>
    <span slot="footer">
        <ButtonGroup align="fill">
            <Button disabled={false} small on:click={() => (step = step - 1)} secondary
                >Previous</Button>
            <Button disabled={false} small on:click={() => (step = step + 1)}>Next</Button>
        </ButtonGroup>
    </span>
</ModalContent>

<style type="text/scss">
    .wrapper {
        width: 100%;
        overflow: hidden;
        height: 500px;
        position: relative;
    }

    .sections {
        display: flex;
        transition: left 250ms ease-in-out;
        position: relative;
        gap: $sp5;
        height: 100%;
        @include mobile() {
            gap: $sp4;
        }
    }

    .details,
    .visibility,
    .rules,
    .permissions {
        flex: 0 0 100%;
    }

    .permissions {
        @include nice-scrollbar();
    }
</style>

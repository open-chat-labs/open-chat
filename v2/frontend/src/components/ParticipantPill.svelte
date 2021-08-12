<script lang="ts">
    import Avatar from "./Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { createEventDispatcher } from "svelte";
    import { AvatarSize, UserStatus } from "../domain/user/user";
    import { avatarUrl } from "../domain/user/user.utils";
    import type { CandidateParticipant } from "../domain/chat/chat";
    const dispatch = createEventDispatcher();

    export let participant: CandidateParticipant;

    function deleteParticipant() {
        dispatch("deleteParticipant", participant);
    }
</script>

<div class="pill">
    <div class="avatar">
        <Avatar
            url={avatarUrl(participant.user.userId)}
            status={UserStatus.None}
            size={AvatarSize.Small} />
    </div>
    <div class="username">{participant.user.username}</div>
    <div on:click={deleteParticipant} class="delete">
        <Close size={"1em"} color={"#fff"} />
    </div>
</div>

<style type="text/scss">
    .pill {
        position: relative;
        margin-bottom: $sp4;
        margin-right: $sp3;
        display: inline-block;
        width: 60px;

        .username {
            @include ellipsis();
            @include size-below(xs) {
                color: #fff;
            }
        }

        .delete {
            position: absolute;
            top: 0;
            right: 10px;
            cursor: pointer;
            width: 20px;
            height: 20px;
            color: #fff;
            background-color: hotpink;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
    }
</style>

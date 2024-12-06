<script lang="ts">
    import { AvatarSize, OpenChat, type BotMatch } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        match: BotMatch;
    }

    let { match }: Props = $props();

    function onClick() {}
</script>

<button class="bot-match" onclick={onClick}>
    <span class="avatar">
        <Avatar url={client.botAvatarUrl(match.avatarId)} size={AvatarSize.Default} />
    </span>
    <div class="details">
        <h4 class="bot-name">
            {match.name}
        </h4>
        <p class="bot-desc">
            {match.description}
        </p>
    </div>
</button>

<style lang="scss">
    .bot-match {
        all: unset;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: $sp4;
        transition:
            background-color ease-in-out 100ms,
            border-color ease-in-out 100ms;
        gap: 12px;
        cursor: pointer;

        @media (hover: hover) {
            &:hover {
                background-color: var(--members-hv);
            }
        }

        @include mobile() {
            padding: $sp3 toRem(10);
        }
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
        align-self: start;
    }

    .details {
        display: flex;
        gap: $sp2;
        flex: 1;
        flex-direction: column;
        @include font(book, normal, fs-100);

        .bot-name {
            @include ellipsis();
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
</style>

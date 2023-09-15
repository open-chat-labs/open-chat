<script lang="ts">
    import type { DataContent, OpenChat } from "openchat-client";
    import Avatar from "../../../Avatar.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "../../Markdown.svelte";
    import { AvatarSize } from "openchat-client";
    import { getContext } from "svelte";
    import CommunityBanner from "../explore/CommunityBanner.svelte";

    const client = getContext<OpenChat>("client");

    export let id: string;
    export let name: string;
    export let description: string;
    export let avatar: DataContent;
    export let banner: DataContent;
</script>

<CommunityBanner blur hero square intersecting {banner}>
    <div class="avatar">
        <Avatar
            url={client.communityAvatarUrl(id, avatar)}
            userId={undefined}
            size={AvatarSize.Medium} />
    </div>
</CommunityBanner>
<div class="content">
    <div class="name">{name}</div>
    <div class="desc">
        <Markdown text={description} />
    </div>
</div>

<style lang="scss">
    .avatar {
        width: toRem(100);
        height: toRem(100);
        position: absolute;
        bottom: toRem(-24);
        left: $sp4;
    }

    .content {
        padding: $sp4;
        padding-top: $sp7;

        .name {
            @include font(bold, normal, fs-130);
            margin-bottom: $sp3;
        }

        .desc {
            @include font(book, normal, fs-100, 28);
            color: var(--txt-light);
            margin-bottom: $sp4;
        }
    }
</style>

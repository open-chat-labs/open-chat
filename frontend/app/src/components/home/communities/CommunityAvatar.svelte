<script lang="ts">
    import type { AvatarSize, CommunitySummary } from "openchat-client";
    import Avatar from "../../Avatar.svelte";

    interface Props {
        selected: boolean;
        avatarSize: AvatarSize;
        community: CommunitySummary;
    }

    let { selected, avatarSize, community }: Props = $props();
</script>

<Avatar
    {selected}
    url={client.communityAvatarUrl(community.id.communityId, community.avatar)}
    size={avatarSize} />

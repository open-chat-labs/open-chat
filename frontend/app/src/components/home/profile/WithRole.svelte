<script lang="ts">
    import type { Member } from "openchat-client";

    export let userId: string | undefined;
    export let communityMembers: Map<string, Member>;
    export let chatMembers: Map<string, Member>;

    $: communityRole = userId ? communityMembers.get(userId)?.role ?? "none" : "none";
    $: chatRole = userId ? chatMembers.get(userId)?.role ?? "none" : "none";
</script>

<slot {communityRole} {chatRole} />

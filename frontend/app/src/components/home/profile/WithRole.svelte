<script lang="ts">
    import type { Member, MemberRole } from "openchat-client";
    import type { Snippet } from "svelte";

    interface Props {
        userId: string | undefined;
        communityMembers: Map<string, Member>;
        chatMembers: Map<string, Member>;
        children?: Snippet<[MemberRole, MemberRole]>;
    }

    let { userId, communityMembers, chatMembers, children }: Props = $props();

    let communityRole = $derived(userId ? communityMembers.get(userId)?.role ?? "none" : "none");
    let chatRole = $derived(userId ? chatMembers.get(userId)?.role ?? "none" : "none");
</script>

{@render children?.(communityRole, chatRole)}

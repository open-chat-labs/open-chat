<script lang="ts">
    import type { ReadonlyMap, Member, MemberRole } from "openchat-client";
    import { ROLE_NONE } from "openchat-client";
    import type { Snippet } from "svelte";

    interface Props {
        userId: string | undefined;
        communityMembers: ReadonlyMap<string, Member>;
        chatMembers: ReadonlyMap<string, Member>;
        children?: Snippet<[MemberRole, MemberRole]>;
    }

    let { userId, communityMembers, chatMembers, children }: Props = $props();

    let communityRole = $derived(userId ? communityMembers.get(userId)?.role ?? ROLE_NONE : ROLE_NONE);
    let chatRole = $derived(userId ? chatMembers.get(userId)?.role ?? ROLE_NONE : ROLE_NONE);
</script>

{@render children?.(communityRole, chatRole)}

<script lang="ts">
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { UserLookup } from "../../domain/user/user";
    import Panel from "../Panel.svelte";
    import Participants from "./Participants.svelte";
    export let groupChat: GroupChatSummary;
    export let users: UserLookup;
</script>

<Panel right>
    <Participants {groupChat} {users} on:close on:dismissAsAdmin on:removeUser />
</Panel>

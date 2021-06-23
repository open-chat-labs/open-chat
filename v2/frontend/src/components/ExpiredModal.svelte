<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
</script>

<ModalContent>
    <span slot="header">Session Expired</span>
    <span slot="body">Please login again</span>
    <span slot="footer">
        <Button on:click={() => dispatch("login")}>Log in</Button>
    </span>
</ModalContent>

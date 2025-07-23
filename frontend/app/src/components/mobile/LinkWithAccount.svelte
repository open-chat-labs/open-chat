<script module lang="ts">
    export type LinkWithAccountType = Component;
</script>

<script lang="ts">
    import type { Component } from "svelte";
    import SignIn from "../onboard/SignIn.svelte";

    function onClose() {
        console.log("BACK TO APP!");
    }
</script>

<div class="body">
    <div class="sign-in-section">
        <SignIn {onClose} spinning={false} />
    </div>
</div>

<style lang="scss">
    .body {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: center;
    }

    .sign-in-section {
        
    }
</style>

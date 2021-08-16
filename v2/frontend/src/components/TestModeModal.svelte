<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
</script>

<ModalContent>
    <span slot="header"> Test Mode </span>
    <span slot="body">
        OpenChat is running in test mode.

        <ul>
            <li>Maximum users 50,000</li>
            <li>Old media files scavenged</li>
            <li>Dummy cycle balances</li>
            <li>Accounts may get reset on beta release</li>
        </ul>

        <em>Enjoy! - Open Chat devs</em>
    </span>
</ModalContent>

<style type="text/scss">
    ul {
        margin: $sp4;
    }
</style>

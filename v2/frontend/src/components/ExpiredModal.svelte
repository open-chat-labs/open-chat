<script lang="ts">
  import ModalContent from "./ModalContent.svelte";
  import { identityService } from "../fsm/identity.machine";
  import Button from "./Button.svelte";
  const { send } = identityService;
</script>

<ModalContent>
  <span slot="header">Session Expired</span>
  <span slot="body">Please login again</span>
  <span slot="footer">
    <Button on:click={() => send({ type: "ACKNOWLEDGE_EXPIRY" })}
      >Log in</Button>
  </span>
</ModalContent>

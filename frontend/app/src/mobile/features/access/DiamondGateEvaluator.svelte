<script lang="ts">
    import Payment from "@src/mobile/features/upgrade/Payment.svelte";

    interface Props {
        lifetime: boolean;
        onCredentialReceived: (cred: string) => void;
        onCancel?: () => void;
    }

    let { lifetime, onCredentialReceived, onCancel }: Props = $props();
</script>

<Payment height={"hug"} {onCancel} padding={"zero"} {lifetime} onSuccess={onCredentialReceived} />

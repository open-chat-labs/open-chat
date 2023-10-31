<script lang="ts">
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { _ } from "svelte-i18n";

    export let valid = true;
    export let ttl = 1000 * 60 * 60;

    let messageTTL = "1";
    let messageTTLUnit: "minutes" | "hours" | "days" = "hours";

    function updateTTL(messageTTL: string) {
        const ttlNum = Number(messageTTL);
        if (isNaN(ttlNum) || messageTTL === "") {
            valid = false;
            return;
        }
        valid = true;
        switch (messageTTLUnit) {
            case "minutes":
                ttl = 1000 * 60 * ttlNum;
                break;
            case "hours":
                ttl = 1000 * 60 * 60 * ttlNum;
                break;
            case "days":
                ttl = 1000 * 60 * 60 * 24 * ttlNum;
                break;
        }

        console.log("TTL: ", ttl);
    }

    $: {
        updateTTL(messageTTL);
    }
</script>

<div class="form">
    <div class="ttl">
        <Input invalid={!valid} maxlength={5} minlength={1} bind:value={messageTTL} />
    </div>

    <div class="units">
        <Select margin={false} on:change={() => updateTTL(messageTTL)} bind:value={messageTTLUnit}>
            <option value={"minutes"}>{$_("disappearingMessages.minutes")}</option>
            <option value={"hours"}>{$_("disappearingMessages.hours")}</option>
            <option value={"days"}>{$_("disappearingMessages.days")}</option>
        </Select>
    </div>
</div>

<style lang="scss">
    .form {
        display: flex;
        gap: $sp3;
    }

    .ttl {
        flex: 0 0 100px;
    }

    .units {
        flex: 0 0 150px;
    }
</style>

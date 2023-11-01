<script lang="ts">
    import { getContext, onMount } from "svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";

    const ONE_MINUTE = 1000 * 60;
    const ONE_HOUR = ONE_MINUTE * 60;
    const ONE_DAY = ONE_HOUR * 24;
    const client = getContext<OpenChat>("client");

    export let valid = true;
    export let ttl: bigint | undefined;
    export let canEditDisappearingMessages: boolean;

    let initialised = false;
    let messageTTL = "1";
    let messageTTLUnit: "minutes" | "hours" | "days" = "hours";

    onMount(() => {
        if (ttl !== undefined) {
            const { days, hours, minutes } = client.durationFromMilliseconds(Number(ttl));
            if (days > 0) {
                messageTTL = days.toString();
                messageTTLUnit = "days";
            } else if (hours > 0) {
                messageTTL = hours.toString();
                messageTTLUnit = "hours";
            } else if (minutes > 0) {
                messageTTL = minutes.toString();
                messageTTLUnit = "minutes";
            }
        }
        initialised = true;
    });

    function updateTTL(messageTTL: string) {
        if (!initialised) return;
        const ttlNum = Number(messageTTL);
        if (isNaN(ttlNum) || messageTTL === "") {
            valid = false;
            return;
        }
        valid = true;
        switch (messageTTLUnit) {
            case "minutes":
                ttl = BigInt(ONE_MINUTE * ttlNum);
                break;
            case "hours":
                ttl = BigInt(ONE_HOUR * ttlNum);
                break;
            case "days":
                ttl = BigInt(ONE_DAY * ttlNum);
                break;
        }
    }

    $: {
        updateTTL(messageTTL);
    }
</script>

<div class="form">
    <div class="ttl">
        <Input
            disabled={!canEditDisappearingMessages}
            invalid={!valid}
            maxlength={5}
            minlength={1}
            bind:value={messageTTL} />
    </div>

    <div class="units">
        <Select
            disabled={!canEditDisappearingMessages}
            margin={false}
            on:change={() => updateTTL(messageTTL)}
            bind:value={messageTTLUnit}>
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

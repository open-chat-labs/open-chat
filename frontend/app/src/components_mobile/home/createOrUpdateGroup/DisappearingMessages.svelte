<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Switch } from "component-lib";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import DisappearingDuration from "../DisappearingDuration.svelte";
    import { updateGroupState } from "./group.svelte";

    let ugs = updateGroupState;
</script>

<DisappearingDuration bind:eventsTTL={ugs.candidateGroup.eventsTTL}>
    {#snippet toggle(onToggle, enabled)}
        <Setting
            toggle={onToggle}
            info={"When enabled, messages older than the specified timeout will get automatically deleted from the group."}>
            <Switch onChange={onToggle} width={{ kind: "fill" }} reverse checked={enabled}>
                <Translatable resourceKey={i18nKey("Enable disappearing messages")}></Translatable>
            </Switch>
        </Setting>
    {/snippet}
</DisappearingDuration>

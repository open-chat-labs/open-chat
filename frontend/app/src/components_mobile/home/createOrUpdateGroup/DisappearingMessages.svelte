<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Switch } from "component-lib";
    import Setting from "../../Setting.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import DisappearingDuration from "../DisappearingDuration.svelte";
    import { updateGroupState } from "./group.svelte";
</script>

<DisappearingDuration bind:eventsTTL={updateGroupState.candidateGroup.eventsTTL}>
    {#snippet toggle(onToggle, enabled)}
        <Setting
            toggle={onToggle}
            info={"When enabled, messages older than the specified timeout will get automatically deleted from the group."}>
            <Switch onChange={onToggle} width={"fill"} reverse checked={enabled}>
                <Translatable resourceKey={i18nKey("Enable disappearing messages")}></Translatable>
            </Switch>
        </Setting>
    {/snippet}
</DisappearingDuration>

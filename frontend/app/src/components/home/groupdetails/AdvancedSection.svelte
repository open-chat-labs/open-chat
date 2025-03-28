<script lang="ts">
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import type { MultiUserChat } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import { publish } from "@src/utils/pubsub";

    interface Props {
        group: MultiUserChat;
    }

    let { group }: Props = $props();

    function deleteGroup() {
        publish("deleteGroup", {
            kind: "delete",
            chatId: group.id,
            level: group.level,
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: group.name }),
                response: i18nKey(group.name),
            },
        });
    }
</script>

<ButtonGroup align="start">
    <Button on:click={deleteGroup}
        ><Translatable resourceKey={i18nKey("deleteGroup", undefined, group.level)} /></Button>
</ButtonGroup>

<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { selectedModelId } from "@src/stores/onDeviceModels";
    import { BodySmall, Button, Container, H2 } from "component-lib";
    import { OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { get } from "svelte/store";
    import { deleteModel, listLocalModels, type LocalModel } from "tauri-plugin-oc-api";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    // On-device inference runs only in the native client; degrade gracefully in the web/PWA build.
    const native = client.isNativeApp();

    let models = $state<LocalModel[]>([]);
    let loading = $state(false);
    let selected = $state(get(selectedModelId));

    async function load() {
        if (!native) return;
        loading = true;
        try {
            models = await listLocalModels();
        } catch {
            models = [];
        } finally {
            loading = false;
        }
    }

    function select(id: string) {
        selectedModelId.set(id);
        selected = id;
    }

    async function remove(id: string) {
        await deleteModel(id);
        if (selected === id) {
            selectedModelId.set("");
            selected = "";
        }
        await load();
    }

    function formatSize(bytes: number): string {
        const gb = bytes / 1024 / 1024 / 1024;
        return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`;
    }

    onMount(load);
</script>

<SlidingPageContent title={i18nKey("On-device models")} subtitle={i18nKey("Run AI privately on your device")}>
    <Container padding={"xxl"} gap={"lg"} height={"fill"} direction={"vertical"}>
        {#if !native}
            <BodySmall>
                <Translatable
                    resourceKey={i18nKey(
                        "On-device models are only available in the OpenChat desktop or mobile app.",
                    )}></Translatable>
            </BodySmall>
        {:else}
            <H2 fontWeight={"bold"} colour={"primary"}>
                <Translatable resourceKey={i18nKey("Downloaded models")}></Translatable>
            </H2>

            {#if loading}
                <BodySmall><Translatable resourceKey={i18nKey("Loading…")}></Translatable></BodySmall>
            {:else if models.length === 0}
                <BodySmall>
                    <Translatable
                        resourceKey={i18nKey(
                            "No models downloaded yet. Models you add from the catalogue will appear here.",
                        )}></Translatable>
                </BodySmall>
            {:else}
                {#each models as model (model.modelId)}
                    <Container gap={"sm"} direction={"vertical"}>
                        <BodySmall fontWeight={"bold"}>{model.modelId}</BodySmall>
                        <BodySmall colour={"textSecondary"}>
                            {model.runtime} · {formatSize(model.sizeBytes)}
                        </BodySmall>
                        <Container gap={"sm"} direction={"horizontal"}>
                            <Button disabled={selected === model.modelId} onClick={() => select(model.modelId)}>
                                <Translatable
                                    resourceKey={i18nKey(selected === model.modelId ? "Selected" : "Select")}
                                ></Translatable>
                            </Button>
                            <Button onClick={() => remove(model.modelId)}>
                                <Translatable resourceKey={i18nKey("Remove")}></Translatable>
                            </Button>
                        </Container>
                    </Container>
                {/each}
            {/if}
        {/if}
    </Container>
</SlidingPageContent>

<script lang="ts">
    import { Body, BodySmall, Container } from "component-lib";
    import {
        type ChatPermissionRole,
        type MemberRole,
        type ResourceKey,
        roleAsText,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Translatable from "../Translatable.svelte";

    interface Props {
        label: ResourceKey;
        rolePermission: ChatPermissionRole | undefined;
        roles: readonly MemberRole[];
        defaultRole?: MemberRole | undefined;
    }

    let { label, rolePermission = $bindable(), roles }: Props = $props();

    let selectedIndex = $derived(roles.findIndex((r) => r === rolePermission));

    function percentFromIndex(idx: number) {
        return (idx / (roles.length - 1)) * 100;
    }

    function select(r: ChatPermissionRole | undefined) {
        rolePermission = r;
    }
</script>

<Container allowOverflow direction={"vertical"} padding={["zero", "lg", "xxl", "lg"]}>
    <div class="label">
        <Body>
            <Translatable resourceKey={label} />
        </Body>
    </div>
    <Container padding={["md", "zero", "lg", "zero"]} mainAxisAlignment={"spaceBetween"}>
        {#each roles as r}
            {@const active = r >= (rolePermission ?? 0)}
            <button class="role_label" onclick={() => select(r)}>
                <BodySmall
                    align={"center"}
                    colour={active ? "primary" : "textSecondary"}
                    fontWeight={"bold"}
                    width={{ kind: "hug" }}>{$_(`role.${roleAsText(r)}`)}</BodySmall>
            </button>
        {/each}
    </Container>

    <Container allowOverflow padding={["zero", "sm"]}>
        <div class="track">
            <div class="progress" style={`width: ${percentFromIndex(selectedIndex)}%`}></div>
            {#each roles as r, i}
                {@const active = r >= (rolePermission ?? 0)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    onclick={() => select(r)}
                    style={`left: ${percentFromIndex(i)}%;`}
                    class="marker-target">
                    <div
                        class:selected={r === rolePermission}
                        class:active
                        class="marker"
                        class:end={i === 0 || i === roles.length - 1}>
                    </div>
                </div>
            {/each}
        </div>
    </Container>
</Container>

<style lang="scss">
    $speed: 200ms;

    .role_label {
        all: unset;
    }

    .label {
        text-transform: capitalize;
    }

    .track,
    .progress {
        position: relative;
        width: 100%;
        height: 4px;
        background-color: var(--button-disabled);
        border-radius: var(--rad-circle);
    }

    .progress {
        transition: width ease-in $speed;
        background-color: var(--primary);
    }

    .marker-target {
        position: absolute;
        top: 2px; // half track height
        width: 1.5rem;
        height: 1.5rem;
        border-radius: var(--rad-circle);
        transform: translateX(-50%) translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;

        .marker {
            border-radius: var(--rad-circle);
            background-color: var(--button-disabled);
            transition:
                background-color ease-in $speed,
                width ease-in $speed,
                height ease-in $speed;
            width: 0.7rem;
            height: 0.7rem;

            &.active {
                background-color: var(--primary);
            }

            &.end {
                width: 1rem;
                height: 1rem;
            }

            &.selected {
                width: 4px;
                height: 1.2rem;
            }
        }
    }
</style>

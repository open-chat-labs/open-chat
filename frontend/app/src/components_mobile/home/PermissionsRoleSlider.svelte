<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, Subtitle, type SizeMode } from "component-lib";
    import {
        ROLE_NONE,
        roleAsText,
        type ChatPermissionRole,
        type MemberRole,
        type ResourceKey,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        height: SizeMode;
        label: ResourceKey;
        rolePermission: ChatPermissionRole | undefined;
        roles: readonly MemberRole[];
        defaultRole?: MemberRole | undefined;
        onClose?: () => void;
    }

    let {
        label,
        height,
        rolePermission = $bindable(),
        roles,
        onClose,
        defaultRole,
    }: Props = $props();

    let usingDefault = $derived(rolePermission === undefined && defaultRole !== undefined);
    let selectedIndex = $derived(
        usingDefault
            ? roles.findIndex((r) => r === defaultRole)
            : roles.findIndex((r) => r === rolePermission),
    );

    function percentFromIndex(idx: number, progress = false) {
        const role = usingDefault ? defaultRole : rolePermission;
        if (role === ROLE_NONE && progress) return 0;
        return (idx / (roles.length - 1)) * 100;
    }

    function select(r: ChatPermissionRole) {
        if (r === defaultRole) {
            rolePermission = undefined;
        } else {
            rolePermission = r;
        }
    }

    function isActive(r: MemberRole) {
        const role = usingDefault ? defaultRole : rolePermission;
        if (role === ROLE_NONE) {
            return role === r;
        }

        return r >= (role ?? 0);
    }

    function roleLabel(r: MemberRole) {
        const parts = [$_(`role.${roleAsText(r)}`)];
        if (r === defaultRole) {
            parts.push(`(${$_("role.default")})`);
        }
        return parts.join(" ");
    }
</script>

<Container gap={"lg"} allowOverflow direction={"vertical"} padding={"xl"}>
    <Container direction={"vertical"} gap={"xs"}>
        <div class="label">
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={label} />
            </Subtitle>
        </div>
        <BodySmall colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Select the lowest role that should have this permission. Higher roles will include it automatically",
                )}></Translatable>
        </BodySmall>
    </Container>

    <Container
        supplementalClass={`permission_slider ${usingDefault ? "faded" : ""}`}
        mainAxisAlignment={"start"}
        padding={["zero", "sm"]}>
        <Container
            width={{ kind: "hug" }}
            direction={"vertical"}
            {height}
            allowOverflow
            padding={["md", "xxl", "md", "zero"]}>
            <div class="track">
                <div class="progress" style={`height: ${percentFromIndex(selectedIndex, true)}%`}>
                </div>
                {#each roles as r, i}
                    {@const active = isActive(r)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => select(r)}
                        style={`top: ${percentFromIndex(i)}%;`}
                        class="marker-target">
                        <div
                            class:selected={usingDefault ? r === defaultRole : r === rolePermission}
                            class:active
                            class="marker"
                            class:end={i === 0 || i === roles.length - 1}>
                        </div>
                    </div>
                {/each}
            </div>
        </Container>
        <Container
            width={{ kind: "hug" }}
            {height}
            direction={"vertical"}
            padding={"zero"}
            mainAxisAlignment={"spaceBetween"}>
            {#each roles as r, i}
                {@const active = isActive(r)}
                <button
                    class="role_label"
                    onclick={() => select(r)}
                    style={`top: ${percentFromIndex(i)}%;`}>
                    <Subtitle
                        align={"center"}
                        colour={active ? "primary" : "textSecondary"}
                        fontWeight={"bold"}
                        width={{ kind: "hug" }}>
                        {roleLabel(r)}
                    </Subtitle>
                </button>
            {/each}
        </Container>
    </Container>

    <Container mainAxisAlignment={"end"} crossAxisAlignment={"end"}>
        <CommonButton onClick={onClose} size={"medium"} mode={"active"}>
            {#snippet icon(color, size)}
                <Save {color} {size}></Save>
            {/snippet}
            <Translatable resourceKey={i18nKey("Done")}></Translatable>
        </CommonButton>
    </Container>
</Container>

<style lang="scss">
    $speed: 200ms;

    .role_label {
        position: absolute;
        all: unset;
    }

    .label {
        text-transform: capitalize;
    }

    .track,
    .progress {
        position: relative;
        width: 4px;
        height: 100%;
        background-color: var(--button-disabled);
        border-radius: var(--rad-circle);
    }

    .progress {
        transition: width ease-in $speed;
        background-color: var(--primary);
    }

    .marker-target {
        position: absolute;
        left: 2px; // half track height
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

            &.end,
            &.selected {
                width: 1rem;
                height: 1rem;
            }
        }
    }
</style>

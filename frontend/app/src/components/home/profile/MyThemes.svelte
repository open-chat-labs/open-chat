<script lang="ts">
    import Radio from "../../Radio.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Menu from "../../Menu.svelte";
    import Legend from "../../Legend.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import PencilOutline from "svelte-material-icons/PencilOutline.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Delete from "svelte-material-icons/Delete.svelte";
    import { _ } from "svelte-i18n";
    import { themeNameStore } from "../../../theme/themes";
    import { iconSize } from "../../../stores/iconSize";
    import { onMount } from "svelte";

    let myThemes = ["My first theme", "Swampy green", "Babyshit yellow"];
    let selectedTheme = "";
    let editing = false;

    onMount(() => {
        return themeNameStore.subscribe((n) => {
            selectedTheme = ["system", "light", "dark"].includes(n) ? "" : n;
        });
    });

    function duplicateTheme(theme: unknown) {}

    function deleteTheme(theme: unknown) {}

    function editTheme(theme: unknown) {
        editing = true;
    }

    function createNewTheme() {
        editing = true;
        console.log("create new theme");
    }
</script>

<div class="my-themes">
    <Legend label={$_("myThemes")}>
        <span on:click={createNewTheme} class="create">Create new</span>
    </Legend>
    {#each myThemes as theme}
        <Radio
            on:change={() => (selectedTheme = theme)}
            value={theme}
            checked={selectedTheme === theme}
            id={`theme_${theme}`}
            group={"my_themes"}>
            <div class="theme">
                <div class="label">
                    {theme}
                </div>
                <div class="menu">
                    <MenuIcon>
                        <div class="icon" slot="icon">
                            <DotsVertical size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                        <div slot="menu">
                            <Menu>
                                <MenuItem on:click={() => editTheme(theme)}>
                                    <PencilOutline
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("editTheme")}</div>
                                </MenuItem>
                                <MenuItem on:click={() => duplicateTheme(theme)}>
                                    <ContentCopy
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("duplicateTheme")}</div>
                                </MenuItem>
                                <MenuItem on:click={() => deleteTheme(theme)}>
                                    <Delete
                                        size={$iconSize}
                                        color={"var(--icon-inverted-txt)"}
                                        slot="icon" />
                                    <div slot="text">{$_("deleteTheme")}</div>
                                </MenuItem>
                            </Menu>
                        </div>
                    </MenuIcon>
                </div>
            </div>
        </Radio>
    {/each}
</div>

{#if editing}
    <Overlay on:close={() => (editing = false)} dismissible={false}>
        <ModalContent>
            <span class="header" slot="header"> Edit theme </span>
            <form class="body" slot="body">Do the editing</form>
            <span slot="footer"> Do we even need a footer </span>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    :global(.radio:hover) {
        .icon {
            opacity: 1;
        }
    }
    .my-themes {
        margin-bottom: $sp4;
    }
    .theme {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .icon {
            transition: opacity 100ms ease-in-out;
            opacity: 0;

            @include mobile() {
                opacity: 1;
            }
        }
    }
    .create {
        @include font(book, normal, fs-60);
        color: var(--accent);
        cursor: pointer;
        position: absolute;
        top: 0;
        right: 0;
    }
</style>

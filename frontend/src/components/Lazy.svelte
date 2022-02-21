<script lang="ts">
    // this represents a dynamic import statement for a module that gives us a default export i.e. a svelte component
    export let component: () => Promise<{ default: unknown }>;

    let props: svelte.JSX.IntrinsicAttributes & { [name: string]: unknown };

    $: {
        // reactively split the component, from any other props
        const { component, ...restProps } = $$props;
        props = restProps;
    }

    // not sure if we will get away with the syntax below. Not sure *when* it is
    // going to run. I want us to try to resolve the promise *only* on mount
    // It's easy enough to refactor when we have the actual code in place
</script>

{#await component()}
    <slot />
{:then module}
    <svelte:component this={module.default} {...props} />
{/await}

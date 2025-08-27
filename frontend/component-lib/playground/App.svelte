<script lang="ts">
    import { theme as neon } from "../src/theme/neon";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";

    neon.writeCssVariables();
</script>

<Colours></Colours>
<Buttons></Buttons>

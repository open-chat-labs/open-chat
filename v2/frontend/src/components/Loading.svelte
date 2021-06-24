<div class="loading" />

<style type="text/scss">
    @import "../styles/mixins";

    .loading {
        height: 100%;
        @include loading-spinner(3em, 1.5em, false, var(--spinner));
    }
</style>

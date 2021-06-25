<script lang="ts">
    import Button from "../Button.svelte";
    import Input from "../Input.svelte";
    import Select from "../Select.svelte";
    import { createEventDispatcher } from "svelte";
    import { allCountries } from "country-telephone-data";
    const dispatch = createEventDispatcher();
    import { _ } from "svelte-i18n";
    import { rtlStore } from "../../stores/rtl";

    let phoneNumberStr: string = "";
    let countryCodeStr: string = "";

    function submitPhoneNumber() {
        dispatch("submitPhoneNumber", { countryCode, number: phoneNumber });
    }

    $: phoneNumber = parseInt(phoneNumberStr.replace(/\D/g, ""), 10);
    $: countryCode = parseInt(countryCodeStr, 10);
    $: valid = !isNaN(phoneNumber) && !isNaN(countryCode);
</script>

<p class="enter-phone">{$_("register.enterPhone")}</p>

<div class="phone-number">
    <div class="country" class:rtl={$rtlStore}>
        <Select bind:value={countryCodeStr}>
            <option disabled={true} selected value="0">{$_("register.countryCode")}</option>
            {#each allCountries as country}
                <option value={country.dialCode}>(+{country.dialCode}) {country.name}</option>
            {/each}
        </Select>
    </div>
    <div class="number">
        <Input
            autofocus={true}
            bind:value={phoneNumberStr}
            minlength={3}
            maxlength={25}
            placeholder="enter your phone number" />
    </div>
</div>

<div class="actions">
    <Button disabled={!valid} on:click={submitPhoneNumber}>
        {$_("register.requestCode")}
    </Button>
</div>

<style type="text/scss">
    @import "../../styles/mixins";

    .phone-number {
        display: flex;
        .country {
            flex: 1;
            margin-right: $sp3;

            &.rtl {
                margin-right: 0;
                margin-left: $sp3;
            }
        }
        .number {
            flex: 3;
        }

        @include size-below(xs) {
            flex-wrap: wrap;
            .country {
                flex-basis: 100%;
                margin-right: 0;
            }
            .number {
                flex-basis: 100%;
            }
        }
    }

    .enter-phone {
        margin-bottom: $sp5;
    }
</style>

<script lang="ts" context="module">
    export type PincodeType = "alphanumeric" | "numeric";
    export type PincodeContext = {
        _type: Readable<PincodeType>;
        _selectTextOnFocus: Writable<boolean>;
        _valuesById: Readable<Record<string, string>>;
        focusNextInput: (id: string) => void;
        add: (id: string, value: string) => void;
        remove: (id: string) => void;
        update: (id: string, input_value: string) => void;
        clear: (id: string) => void;
    };
</script>

<script lang="ts">
    import { setContext, createEventDispatcher, afterUpdate } from "svelte";
    import { writable, derived, type Writable, type Readable } from "svelte/store";

    export let code: string[] = [];
    export let value: string = "";
    export let type: PincodeType = "alphanumeric";
    export let complete: boolean = false;
    export let selectTextOnFocus: boolean = false;
    export const focusFirstInput = () => {
        ref?.querySelector("input")?.focus();
    };
    export const focusNextEmptyInput = () => {
        const inputs = ref?.querySelectorAll("input");
        if (inputs !== undefined) {
            for (const input of inputs) {
                if (input.value.length === 0) {
                    input.focus();
                    break;
                }
            }
        }
    };
    export const focusLastInput = () => {
        const lastInp = ref?.querySelector("input:last-of-type") as HTMLInputElement | null;
        lastInp?.focus();
    };

    type Id = {
        id: string;
        value: string;
    };

    const dispatch = createEventDispatcher();
    const _ids = writable<Id[]>([]);
    const _valuesById = derived(_ids, (_) => {
        return _.reduce((a, c) => ({ ...a, [c.id]: c.value }), {} as Record<string, string>);
    });
    const _type = writable(type);
    const _selectTextOnFocus = writable(selectTextOnFocus);

    let ref: HTMLDivElement | undefined = undefined;
    let prevValue = value;

    function setCode() {
        code = $_ids.map((_) => _.value || "");
    }

    function focusNextInput(idx: number) {
        const inputs = ref?.querySelectorAll("input");
        if (inputs) {
            const nextInput = inputs[idx + 1];
            nextInput?.focus();
        }
    }

    setContext<PincodeContext>("Pincode", {
        _type,
        _selectTextOnFocus,
        _valuesById,
        focusNextInput: (id: string) => {
            const idx = $_ids.map((id) => id.id).indexOf(id);
            focusNextInput(idx);
        },
        add: (id: string, value: string) => {
            const _code = [...code];

            _ids.update((ids) => {
                if (code[ids.length] === undefined) {
                    _code[ids.length] = value;
                } else {
                    _code[ids.length] = _code[ids.length] || value;
                }

                return [
                    ...ids,
                    {
                        id,
                        value: code[ids.length] || value,
                    },
                ];
            });

            code = _code;
        },
        remove: (id: string) => {
            _ids.update((ids) => ids.filter((_id) => _id.id !== id));
            setCode();
        },
        update: (id: string, input_value: string) => {
            const idx = $_ids.map((_) => _.id).indexOf(id);

            _ids.update((_) => {
                return _.map((_id, i) => {
                    if (i === idx) return { ..._id, value: input_value };
                    return _id;
                });
            });

            setCode();
            focusNextInput(idx);
        },
        clear: (id: string) => {
            const idx = $_ids.map((_) => _.id).indexOf(id);

            if (!$_ids[idx].value) {
                const inputs = ref?.querySelectorAll("input");
                if (inputs) {
                    const prevInput = inputs[idx - 1];
                    prevInput?.focus();
                    prevInput?.select();
                }
            }

            _ids.update((_) => {
                return _.map((_id, i) => {
                    if (i === idx) return { ..._id, value: "" };
                    return _id;
                });
            });

            setCode();
        },
    });

    afterUpdate(() => {
        if (complete) dispatch("complete", { code, value });
    });

    function handleInput(e: Event) {
        const target = e.target as HTMLInputElement;
        let input = target.value;
        if (!input) return;
        input = input.trim();
        if (input.length === 1) return;
        if (input.length !== $_ids.length) return;
        code = input.split("");
    }

    function handlePaste(e: ClipboardEvent) {
        e.preventDefault();
        code =
            e.clipboardData
                ?.getData("text")
                .split("")
                .filter((it) => it !== " ") ?? [];
    }

    $: _type.set(type);
    $: _selectTextOnFocus.set(selectTextOnFocus);
    $: value = code.join("");
    $: complete = code.length > 0 && code.filter(Boolean).length === $_ids.length;
    $: if (code) {
        _ids.update((_) => {
            return _.map((_id, i) => ({ ..._id, value: code[i] }));
        });
    }

    $: if (code.length === 0) {
        _ids.update((_) => _.map((_id) => ({ ..._id, value: "" })));
    }

    $: {
        if (prevValue !== value && value.length === 0) {
            dispatch("clear");
        }

        prevValue = value;
    }
</script>

<div data-pincode bind:this={ref} {...$$restProps} on:input={handleInput} on:paste={handlePaste}>
    <slot />
</div>

<style lang="scss">
    [data-pincode] {
        display: inline-flex;
        // border: 1px solid #e0e0e0;
        border: var(--bw) solid var(--input-bd);
    }
</style>

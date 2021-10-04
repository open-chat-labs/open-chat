import { writable } from "svelte/store";

const unconfirmed = writable(new Set<bigint>());
const unconfirmedReadByUs = writable(new Set<bigint>());
const unconfirmedReadByThem = writable(new Set<bigint>());

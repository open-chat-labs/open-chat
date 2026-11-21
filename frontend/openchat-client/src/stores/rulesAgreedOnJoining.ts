import type { RulesAgreedOnJoining } from "@shared";
import { writable } from "../utils/stores";
import { noRulesAgreed } from "../utils/rulesOnJoining";

/**
 * The rules the user agreed to as they joined a group, channel or community (the new UIs' "Agree
 * and join"), which their first message there accepts (`rulesAgreedOnJoining`). The client loads
 * it from the user's cache on the device as the session starts, and writes it back on every change
 * (`withRulesAgreed`, `withoutRulesAgreed`).
 */
export const rulesAgreedOnJoiningStore = writable<RulesAgreedOnJoining>(noRulesAgreed());

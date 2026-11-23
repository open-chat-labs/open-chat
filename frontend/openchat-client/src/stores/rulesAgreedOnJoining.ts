import { noRulesAgreed, type RulesAgreedOnJoining } from "@shared";
import { writable } from "../utils/stores";

/**
 * The rules the user agreed to as they joined a group, channel or community (the new UIs' "Agree
 * and join"), which their first message there accepts (`rulesAgreedOnJoining`): what the user's
 * cache on the device holds, as the client last read or changed it there (`#updateRulesAgreed`,
 * the first time as the session starts).
 */
export const rulesAgreedOnJoiningStore = writable<RulesAgreedOnJoining>(noRulesAgreed());

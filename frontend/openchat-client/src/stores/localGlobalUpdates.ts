import { GlobalMap, type LocalGlobalUpdates, type StreakInsurance } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

class LocalGlobalUpdatesStore extends LocalUpdatesStore<"global", LocalGlobalUpdates> {
    constructor() {
        super(new GlobalMap());
    }

    updateStreakInsurance(streakInsurance: StreakInsurance) {
        this.applyUpdate("global", (_) => ({
            streakInsurance,
        }));
    }
}

export const localGlobalUpdates = new LocalGlobalUpdatesStore();

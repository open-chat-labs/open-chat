import type { CommunityIdentifier, OptionUpdate } from "openchat-shared";
import { CommunityMapStore } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class CommunitySummaryUpdates {
    displayName: OptionUpdate<string> = undefined;
    rulesAccepted?: boolean;
    index?: number;
}

export class CommunitySummaryUpdatesManager extends CommunityMapStore<CommunitySummaryUpdates> {
    #getOrCreate(id: CommunityIdentifier): CommunitySummaryUpdates {
        return this.get(id) ?? new CommunitySummaryUpdates();
    }

    updateRulesAccepted(id: CommunityIdentifier, accepted?: boolean) {
        const state = this.#getOrCreate(id);
        const previous = state.rulesAccepted;
        state.rulesAccepted = accepted;
        this.set(id, state);
        // TODO - as it stands this undo will trigger a publish.
        // This *might* be unnecessary and could be optimised
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, rulesAccepted: previous }));
        });
    }

    updateDisplayName(id: CommunityIdentifier, name?: string) {
        const state = this.#getOrCreate(id);
        const previous = state.displayName;
        state.displayName = name !== undefined ? { value: name } : "set_to_none";
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, displayName: previous }));
        });
    }

    updateIndex(id: CommunityIdentifier, index?: number): UndoLocalUpdate {
        const state = this.#getOrCreate(id);
        const previous = state.index;
        state.index = index;
        this.set(id, state);
        return scheduleUndo(() => {
            this.update(id, (val) => ({ ...val, index: previous }));
        });
    }
}

export const communitySummaryLocalUpdates = new CommunitySummaryUpdatesManager();

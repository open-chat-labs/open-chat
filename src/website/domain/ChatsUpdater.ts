import getUpdatedChats, {
    GET_UPDATED_CHATS_SUCCEEDED,
    GetUpdatedChatsFailedEvent,
    GetUpdatedChatsSucceededEvent
} from "../actions/chats/getUpdatedChats";
import ExponentialBackoffRecurringTaskRunner, { StartOptions } from "./ExponentialBackoffRecurringTaskRunner";
import { REFRESH_CHATS_MAX_INTERVAL_MS, REFRESH_CHATS_MIN_INTERVAL_MS } from "../constants";
import { Option, Timestamp } from "./model/common";
import store from "../store";

class ChatsUpdater {
    private taskRunner?: ExponentialBackoffRecurringTaskRunner;

    public startNew = (chatsSyncedUpTo: Option<Timestamp>) => {
        if (this.taskRunner) {
            this.taskRunner.stop();
        }

        this.taskRunner = ExponentialBackoffRecurringTaskRunner.startNew(
            () => this.getUpdates(chatsSyncedUpTo),
            REFRESH_CHATS_MIN_INTERVAL_MS,
            REFRESH_CHATS_MAX_INTERVAL_MS,
            1.2,
            StartOptions.WaitBeforeFirstRun);
    }

    public triggerUpdate = () : Promise<void> => {
        return this.taskRunner
            ? this.taskRunner.restart(StartOptions.AwaitFirstRun)
            : Promise.resolve();
    }

    public stop = () => {
        if (this.taskRunner) {
            this.taskRunner.stop();
            this.taskRunner = undefined;
        }
    }

    private getUpdates = async (chatsSyncedUpTo: Option<Timestamp>) : Promise<boolean> => {
        const result = await (store.dispatch(getUpdatedChats(chatsSyncedUpTo) as any) as any as Promise<GetUpdatedChatsSucceededEvent | GetUpdatedChatsFailedEvent>);
        return result.type === GET_UPDATED_CHATS_SUCCEEDED && result.payload.chats.length > 0;
    }
}

const chatsUpdater = new ChatsUpdater();

export default chatsUpdater;

import { MessageMap, type LocalMessageUpdates } from "openchat-shared";
import { LocalUpdatesStore } from "./localUpdatesStore";

export class LocalMessageUpdatesStore extends LocalUpdatesStore<bigint, LocalMessageUpdates> {}

export const localMessageUpdates = new LocalMessageUpdatesStore(new MessageMap());

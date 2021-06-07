import { Option } from "./model/common";
import { ChatId } from "./model/chats";
import * as u64 from "../utils/u64Functions";

export const extractChatIdFromLocation = () : Option<ChatId> => {
    let path = document.location.pathname;
    if (path.length > 0 && path[0] == '/') {
        path = path.slice(1);
    }
    const parts = path.split('/');
    if (parts.length > 0 && parts[0].length > 0) {
        try {
            return u64.fromHex(parts[0]);
        } catch {
            return null;            
        }
    }
    return null;
}

export function replaceLatestWithHome() {
    if (!history) return;
    history.replaceState(null, "Home", "/");
}

export function pushOrReplaceChat(chatId: ChatId, replace: boolean) {
    if (!history) return;
    const hexId = u64.toHex(chatId);
    const method = replace ? "replaceState" : "pushState";
    history[method]({ chatId }, "", `/${hexId}`);
}


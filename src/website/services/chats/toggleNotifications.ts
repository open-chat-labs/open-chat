import CanisterClientFactory from "../CanisterClientFactory";
import { ChatId } from "../../domain/model/chats";

export default async function(chatId: ChatId, mute: boolean) : Promise<void> {
    const client = CanisterClientFactory.current!.chatsClient;
    await client.toggle_notifications(chatId, mute);
}

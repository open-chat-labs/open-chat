import CanisterClientFactory from "../CanisterClientFactory";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { UserId } from "../../domain/model/users";

export default async function(userId: UserId, unblock: boolean) : Promise<void> {
    const client = CanisterClientFactory.current!.chatsClient;
    await client.block_user(userIdToCandid(userId), unblock);
}

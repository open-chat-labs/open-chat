import CanisterClientFactory from "../CanisterClientFactory";

export default async function() : Promise<void> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    await client.mark_as_online();
}

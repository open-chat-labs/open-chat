import canister from "ic:canisters/user_mgmt";

export default async function() : Promise<void> {
    await canister.mark_as_online();
}

use canister_client::operations::install_service_canisters;
use canister_client::utils::get_dfx_identity;
use canister_client::CanisterIds;
use clap::Parser;
use types::CanisterId;

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let canister_ids = CanisterIds {
        user_index: opts.user_index,
        group_index: opts.group_index,
        notifications_index: opts.notifications_index,
        local_user_index: opts.local_user_index,
        local_group_index: opts.local_group_index,
        notifications: opts.notifications,
        online_users: opts.online_users,
        proposals_bot: opts.proposals_bot,
        cycles_dispenser: opts.cycles_dispenser,
        storage_index: opts.storage_index,
        nns_governance: opts.nns_governance,
        nns_ledger: opts.nns_ledger,
        nns_cmc: opts.nns_cmc,
    };

    let identity = get_dfx_identity(&opts.controller);

    install_service_canisters(identity, opts.url, canister_ids, opts.test_mode).await;
}

#[derive(Parser)]
struct Opts {
    url: String,
    #[clap(parse(try_from_str))]
    test_mode: bool,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications_index: CanisterId,
    local_user_index: CanisterId,
    local_group_index: CanisterId,
    notifications: CanisterId,
    online_users: CanisterId,
    proposals_bot: CanisterId,
    cycles_dispenser: CanisterId,
    storage_index: CanisterId,
    nns_governance: CanisterId,
    nns_ledger: CanisterId,
    nns_cmc: CanisterId,
}

use canister_agent_utils::{get_dfx_identity, CanisterIds};
use canister_installer::install_service_canisters;
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
        storage_index: opts.storage_index,
        cycles_dispenser: opts.cycles_dispenser,
        registry: opts.registry,
        market_maker: opts.market_maker,
        nns_governance: opts.nns_governance,
        nns_internet_identity: opts.nns_internet_identity,
        nns_ledger: opts.nns_ledger,
        nns_cmc: opts.nns_cmc,
    };

    let identity = get_dfx_identity(&opts.controller);

    install_service_canisters(identity, opts.url, canister_ids, opts.test_mode).await;
}

#[derive(Parser)]
struct Opts {
    #[arg(long)]
    url: String,

    #[arg(long, action = clap::ArgAction::Set)]
    test_mode: bool,

    #[arg(long)]
    controller: String,

    #[arg(long)]
    user_index: CanisterId,

    #[arg(long)]
    group_index: CanisterId,

    #[arg(long)]
    notifications_index: CanisterId,

    #[arg(long)]
    local_user_index: CanisterId,

    #[arg(long)]
    local_group_index: CanisterId,

    #[arg(long)]
    notifications: CanisterId,

    #[arg(long)]
    online_users: CanisterId,

    #[arg(long)]
    proposals_bot: CanisterId,

    #[arg(long)]
    storage_index: CanisterId,

    #[arg(long)]
    cycles_dispenser: CanisterId,

    #[arg(long)]
    registry: CanisterId,

    #[arg(long)]
    market_maker: CanisterId,

    #[arg(long)]
    nns_governance: CanisterId,

    #[arg(long)]
    nns_internet_identity: CanisterId,

    #[arg(long)]
    nns_ledger: CanisterId,

    #[arg(long)]
    nns_cmc: CanisterId,
}

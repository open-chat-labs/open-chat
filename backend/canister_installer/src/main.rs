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
    #[arg(short, long)]
    url: String,

    #[arg(short, long)]
    test_mode: bool,

    #[arg(short, long)]
    controller: String,

    #[arg(short, long)]
    user_index: CanisterId,

    #[arg(short, long)]
    group_index: CanisterId,

    #[arg(short, long)]
    notifications_index: CanisterId,

    #[arg(short, long)]
    local_user_index: CanisterId,

    #[arg(short, long)]
    local_group_index: CanisterId,

    #[arg(short, long)]
    notifications: CanisterId,

    #[arg(short, long)]
    online_users: CanisterId,

    #[arg(short, long)]
    proposals_bot: CanisterId,

    #[arg(short, long)]
    storage_index: CanisterId,

    #[arg(short, long)]
    cycles_dispenser: CanisterId,

    #[arg(short, long)]
    market_maker: CanisterId,

    #[arg(short, long)]
    nns_governance: CanisterId,

    #[arg(short, long)]
    nns_internet_identity: CanisterId,

    #[arg(short, long)]
    nns_ledger: CanisterId,

    #[arg(short, long)]
    nns_cmc: CanisterId,
}

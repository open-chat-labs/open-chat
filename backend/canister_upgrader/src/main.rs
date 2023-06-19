use canister_agent_utils::{get_dfx_identity, CanisterName};
use canister_upgrader::*;
use clap::Parser;
use types::{CanisterId, Version};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.controller);

    match opts.canister_to_upgrade {
        CanisterName::Community => upgrade_group_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::CyclesDispenser => {
            upgrade_cycles_dispenser_canister(identity, opts.url, opts.cycles_dispenser, opts.version).await
        }
        CanisterName::Group => upgrade_group_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::LocalGroupIndex => {
            upgrade_local_group_index_canister(identity, opts.url, opts.group_index, opts.version).await
        }
        CanisterName::GroupIndex => upgrade_group_index_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::MarketMaker => upgrade_market_maker_canister(identity, opts.url, opts.market_maker, opts.version).await,
        CanisterName::NotificationsIndex => {
            upgrade_notifications_index_canister(identity, opts.url, opts.notifications_index, opts.version).await
        }
        CanisterName::Notifications => {
            upgrade_notifications_canister(identity, opts.url, opts.notifications_index, opts.version).await
        }
        CanisterName::OnlineUsers => upgrade_online_users_canister(identity, opts.url, opts.online_users, opts.version).await,
        CanisterName::ProposalsBot => {
            upgrade_proposals_bot_canister(identity, opts.url, opts.proposals_bot, opts.version).await
        }
        CanisterName::StorageBucket => {
            upgrade_storage_bucket_canister(identity, opts.url, opts.storage_index, opts.version).await
        }
        CanisterName::StorageIndex => {
            upgrade_storage_index_canister(identity, opts.url, opts.storage_index, opts.version).await
        }
        CanisterName::User => upgrade_user_canister(identity, opts.url, opts.user_index, opts.version).await,
        CanisterName::LocalUserIndex => {
            upgrade_local_user_index_canister(identity, opts.url, opts.user_index, opts.version).await
        }
        CanisterName::UserIndex => upgrade_user_index_canister(identity, opts.url, opts.user_index, opts.version).await,
    };
}

#[derive(Parser)]
struct Opts {
    #[arg(short, long)]
    url: String,

    #[arg(short, long)]
    controller: String,

    #[arg(short, long)]
    user_index: CanisterId,

    #[arg(short, long)]
    group_index: CanisterId,

    #[arg(short, long)]
    notifications_index: CanisterId,

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
    canister_to_upgrade: CanisterName,

    #[arg(short, long)]
    version: Version,
}

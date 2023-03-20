use canister_agent::operations::*;
use canister_agent::utils::get_dfx_identity;
use canister_agent::CanisterName;
use clap::Parser;
use types::{CanisterId, Version};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.controller);

    match opts.canister_to_upgrade {
        CanisterName::CyclesDispenser => {
            upgrade_cycles_dispenser_canister(identity, opts.url, opts.cycles_dispenser, opts.version).await
        }
        CanisterName::Group => upgrade_group_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::LocalGroupIndex => {
            upgrade_local_group_index_canister(identity, opts.url, opts.group_index, opts.version).await
        }
        CanisterName::GroupIndex => upgrade_group_index_canister(identity, opts.url, opts.group_index, opts.version).await,
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
    url: String,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications_index: CanisterId,
    online_users: CanisterId,
    proposals_bot: CanisterId,
    storage_index: CanisterId,
    cycles_dispenser: CanisterId,
    canister_to_upgrade: CanisterName,
    version: Version,
}

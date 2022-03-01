use canister_client::operations::*;
use canister_client::utils::get_dfx_identity;
use canister_client::CanisterName;
use clap::Parser;
use types::{CanisterId, Version};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.controller);

    match opts.canister_to_upgrade {
        CanisterName::Callback => upgrade_callback_canister(identity, opts.url, opts.callback, opts.version).await,
        CanisterName::Group => upgrade_group_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::GroupIndex => upgrade_group_index_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::Notifications => {
            upgrade_notifications_canister(identity, opts.url, opts.notifications, opts.version).await
        }
        CanisterName::Root => unimplemented!(),
        CanisterName::OnlineUsersAggregator => {
            upgrade_online_users_aggregator_canister(identity, opts.url, opts.online_users_aggregator, opts.version).await
        }
        CanisterName::User => upgrade_user_canister(identity, opts.url, opts.user_index, opts.version).await,
        CanisterName::UserIndex => upgrade_user_index_canister(identity, opts.url, opts.root, opts.version).await,
    };
}

#[derive(Parser)]
struct Opts {
    url: String,
    controller: String,
    root: CanisterId,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications: CanisterId,
    online_users_aggregator: CanisterId,
    callback: CanisterId,
    canister_to_upgrade: CanisterName,
    version: Version,
}

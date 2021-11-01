use canister_client::operations::*;
use canister_client::utils::get_dfx_identity;
use canister_client::CanisterName;
use clap::{AppSettings, Clap};
use types::{CanisterId, Version};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.controller);

    match opts.canister_to_upgrade {
        CanisterName::Group => {
            upgrade_group_canister(
                identity,
                opts.url,
                opts.group_index,
                opts.version.expect("'version' must be specified"),
            )
            .await
        }
        CanisterName::GroupIndex => upgrade_group_index_canister(identity, opts.url, opts.group_index).await,
        CanisterName::Notifications => upgrade_notifications_canister(identity, opts.url, opts.notifications).await,
        CanisterName::OnlineUsersAggregator => {
            upgrade_online_users_aggregator_canister(identity, opts.url, opts.online_users_agg).await
        }
        CanisterName::User => {
            upgrade_user_canister(
                identity,
                opts.url,
                opts.user_index,
                opts.version.expect("'version' must be specified"),
            )
            .await
        }
        CanisterName::UserIndex => upgrade_user_index_canister(identity, opts.url, opts.user_index).await,
    };
}

#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
struct Opts {
    url: String,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications: CanisterId,
    online_users_agg: CanisterId,
    canister_to_upgrade: CanisterName,
    version: Option<Version>,
}

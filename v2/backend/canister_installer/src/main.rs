use canister_client::operations::install_service_canisters;
use canister_client::utils::get_dfx_identity;
use canister_client::CanisterIds;
use clap::{AppSettings, Clap};
use types::CanisterId;

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let canister_ids = CanisterIds {
        user_index: opts.user_index,
        group_index: opts.group_index,
        notifications: opts.notifications,
        online_users_aggregator: opts.online_users_aggregator,
        open_storage_index: opts.open_storage_index,
    };

    let identity = get_dfx_identity(&opts.controller);

    install_service_canisters(identity, opts.url, canister_ids, opts.test_mode).await;
}

#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
struct Opts {
    url: String,
    #[clap(parse(try_from_str))]
    test_mode: bool,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications: CanisterId,
    online_users_aggregator: CanisterId,
    open_storage_index: CanisterId,
}

use canister_client::operations::install_service_canisters;
use canister_client::utils::get_dfx_identity;
use canister_client::CanisterIds;
use clap::{AppSettings, Clap};
use types::CanisterId;

#[tokio::main]
async fn main() {
    let opts = Opts::parse();
    let test_mode = opts.test_mode != 0;

    let canister_ids = CanisterIds {
        user_index: opts.user_index,
        group_index: opts.group_index,
        notifications: opts.notifications,
    };

    let identity = get_dfx_identity(&opts.controller);

    install_service_canisters(identity, opts.url, canister_ids, test_mode).await;
}

#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
struct Opts {
    url: String,
    test_mode: u32,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications: CanisterId,
}

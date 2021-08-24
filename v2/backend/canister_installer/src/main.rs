use canister_client::operations::install_service_canisters;
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
    };

    install_service_canisters(opts.url, opts.controller, canister_ids).await;
}

#[derive(Clap)]
#[clap(setting = AppSettings::ColoredHelp)]
struct Opts {
    url: String,
    controller: String,
    user_index: CanisterId,
    group_index: CanisterId,
    notifications: CanisterId,
}

use canister_agent_utils::{get_dfx_identity, CanisterName};
use canister_wasm_chunks_uploader::*;
use clap::Parser;
use types::{BuildVersion, CanisterId};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.dfx_identity);

    match opts.canister_to_upload {
        CanisterName::Community => upload_community_canister_wasm(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::Group => upload_group_canister_wasm(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::GroupIndex => {
            upload_group_index_canister_wasm(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        CanisterName::LocalGroupIndex => {
            upload_local_group_index_canister_wasm(identity, opts.url, opts.group_index, opts.version).await
        }
        CanisterName::LocalUserIndex => {
            upload_local_user_index_canister_wasm(identity, opts.url, opts.user_index, opts.version).await
        }
        CanisterName::NotificationsIndex => {
            upload_notifications_index_canister_wasm(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        CanisterName::User => upload_user_canister_wasm(identity, opts.url, opts.user_index, opts.version).await,
        CanisterName::UserIndex => {
            upload_user_index_canister_wasm(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        _ => panic!("This canister does not require chunked upgrades"),
    };
}

#[derive(Parser)]
struct Opts {
    #[arg(long)]
    url: String,

    #[arg(long)]
    dfx_identity: String,

    #[arg(long)]
    openchat_installer: CanisterId,

    #[arg(long)]
    user_index: CanisterId,

    #[arg(long)]
    group_index: CanisterId,

    #[arg(long)]
    canister_to_upload: CanisterName,

    #[arg(long)]
    version: BuildVersion,
}

use canister_agent_utils::{CanisterName, get_dfx_identity};
use canister_upgrader::*;
use clap::Parser;
use types::{BuildVersion, CanisterId};

#[tokio::main]
async fn main() {
    let opts = Opts::parse();

    let identity = get_dfx_identity(&opts.controller);

    match opts.canister_to_upgrade {
        CanisterName::AirdropBot => upgrade_airdrop_bot_canister(identity, opts.url, opts.airdrop_bot, opts.version).await,
        CanisterName::Community => upgrade_community_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::CyclesDispenser => {
            upgrade_cycles_dispenser_canister(identity, opts.url, opts.cycles_dispenser, opts.version).await
        }
        CanisterName::Escrow => upgrade_escrow_canister(identity, opts.url, opts.escrow, opts.version).await,
        CanisterName::EventRelay => upgrade_event_relay_canister(identity, opts.url, opts.event_relay, opts.version).await,
        CanisterName::EventStore => upgrade_event_store_canister(identity, opts.url, opts.event_store, opts.version).await,
        CanisterName::Group => upgrade_group_canister(identity, opts.url, opts.group_index, opts.version).await,
        CanisterName::GroupIndex => {
            upgrade_group_index_canister(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        CanisterName::Identity => upgrade_identity_canister(identity, opts.url, opts.identity, opts.version).await,
        CanisterName::MarketMaker => upgrade_market_maker_canister(identity, opts.url, opts.market_maker, opts.version).await,
        CanisterName::NeuronController => {
            upgrade_neuron_controller_canister(identity, opts.url, opts.neuron_controller, opts.version).await
        }
        CanisterName::NotificationsIndex => {
            upgrade_notifications_index_canister(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        CanisterName::OnlineUsers => upgrade_online_users_canister(identity, opts.url, opts.online_users, opts.version).await,
        CanisterName::OpenChatInstaller => {
            upgrade_openchat_installer_canister(identity, opts.url, opts.openchat_installer, opts.version).await
        }
        CanisterName::ProposalsBot => {
            upgrade_proposals_bot_canister(identity, opts.url, opts.proposals_bot, opts.version).await
        }
        CanisterName::Registry => upgrade_registry_canister(identity, opts.url, opts.registry, opts.version).await,
        CanisterName::Translations => upgrade_translations_canister(identity, opts.url, opts.translations, opts.version).await,
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
        CanisterName::UserIndex => upgrade_user_index_canister(identity, opts.url, opts.openchat_installer, opts.version).await,
        CanisterName::SignInWithEmail => {
            upgrade_sign_in_with_email_canister(identity, opts.url, opts.sign_in_with_email, opts.version).await
        }
        CanisterName::SignInWithEthereum | CanisterName::SignInWithSolana => unimplemented!(),
    };
}

#[derive(Parser)]
struct Opts {
    #[arg(long)]
    url: String,

    #[arg(long)]
    controller: String,

    #[arg(long)]
    openchat_installer: CanisterId,

    #[arg(long)]
    user_index: CanisterId,

    #[arg(long)]
    group_index: CanisterId,

    #[arg(long)]
    notifications_index: CanisterId,

    #[arg(long)]
    identity: CanisterId,

    #[arg(long)]
    online_users: CanisterId,

    #[arg(long)]
    proposals_bot: CanisterId,

    #[arg(long)]
    airdrop_bot: CanisterId,

    #[arg(long)]
    storage_index: CanisterId,

    #[arg(long)]
    cycles_dispenser: CanisterId,

    #[arg(long)]
    registry: CanisterId,

    #[arg(long)]
    translations: CanisterId,

    #[arg(long)]
    market_maker: CanisterId,

    #[arg(long)]
    neuron_controller: CanisterId,

    #[arg(long)]
    escrow: CanisterId,

    #[arg(long)]
    event_relay: CanisterId,

    #[arg(long)]
    event_store: CanisterId,

    #[arg(long)]
    sign_in_with_email: CanisterId,

    #[arg(long)]
    canister_to_upgrade: CanisterName,

    #[arg(long)]
    version: BuildVersion,
}

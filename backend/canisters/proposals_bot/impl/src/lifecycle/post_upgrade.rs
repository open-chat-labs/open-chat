use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use proposals_bot_canister::post_upgrade::Args;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{GroupPermissionRole, MultiUserChat, OptionUpdate, OptionalGroupPermissions, OptionalMessagePermissions};
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let chats: Vec<_> = read_state(|state| state.data.nervous_systems.metrics().iter().map(|ns| ns.chat_id).collect());

    ic_cdk_timers::set_timer(Duration::ZERO, move || ic_cdk::spawn(set_message_permissions(chats)));
}

async fn set_message_permissions(chats: Vec<MultiUserChat>) {
    for chat in chats {
        match chat {
            MultiUserChat::Group(chat_id) => {
                let _ = group_canister_c2c_client::update_group_v2(
                    chat_id.into(),
                    &group_canister::update_group_v2::Args {
                        permissions_v2: Some(OptionalGroupPermissions {
                            thread_permissions: OptionUpdate::SetToSome(OptionalMessagePermissions {
                                default: Some(GroupPermissionRole::Members),
                                poll: OptionUpdate::SetToNone,
                                ..Default::default()
                            }),
                            ..Default::default()
                        }),
                        ..Default::default()
                    },
                )
                .await;
            }
            MultiUserChat::Channel(community_id, channel_id) => {
                let _ = community_canister_c2c_client::update_channel(
                    community_id.into(),
                    &community_canister::update_channel::Args {
                        channel_id,
                        permissions_v2: Some(OptionalGroupPermissions {
                            thread_permissions: OptionUpdate::SetToSome(OptionalMessagePermissions {
                                default: Some(GroupPermissionRole::Members),
                                poll: OptionUpdate::SetToNone,
                                ..Default::default()
                            }),
                            ..Default::default()
                        }),
                        name: Default::default(),
                        description: Default::default(),
                        rules: Default::default(),
                        avatar: Default::default(),
                        events_ttl: Default::default(),
                        gate: Default::default(),
                        public: Default::default(),
                    },
                )
                .await;
            }
        }
    }
}

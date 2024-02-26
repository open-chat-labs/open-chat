use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use event_sink_client::EventBuilder;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::{MessageEventPayload, UserId};
use user_canister::post_upgrade::Args;
use utils::consts::{OPENCHAT_BOT_USERNAME, OPENCHAT_BOT_USER_ID};

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        let my_user_id: UserId = state.env.canister_id().into();
        let user_string = my_user_id.to_string();

        let events_iter = state
            .data
            .direct_chats
            .iter()
            .flat_map(|c| c.events.iter_all_events())
            .filter_map(|e| {
                if let ChatEventInternal::Message(m) = &e.event {
                    let is_oc_bot = m.sender == OPENCHAT_BOT_USER_ID;
                    if m.sender == my_user_id || is_oc_bot {
                        return Some(
                            EventBuilder::new("message_sent", e.timestamp)
                                .with_user(if is_oc_bot { OPENCHAT_BOT_USERNAME.to_string() } else { user_string.clone() })
                                .with_source(user_string.clone())
                                .with_json_payload(&MessageEventPayload {
                                    message_type: m.content.message_type(),
                                    sender_is_bot: is_oc_bot,
                                })
                                .build(),
                        );
                    }
                }
                None
            });

        state.data.event_sink_client.push_many(events_iter, false);
    });
}

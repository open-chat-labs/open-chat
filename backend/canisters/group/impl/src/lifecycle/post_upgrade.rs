use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use event_sink_client::EventBuilder;
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::MessageEventPayload;

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

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    mutate_state(|state| {
        let source_string = state.env.canister_id().to_string();
        let events_iter = state.data.chat.events.iter_all_events().filter_map(|e| {
            if let ChatEventInternal::Message(m) = &e.event {
                let is_proposals_bot = m.sender == state.data.proposals_bot_user_id;
                Some(
                    EventBuilder::new("message_sent", e.timestamp)
                        .with_user(if is_proposals_bot { "ProposalsBot".to_string() } else { m.sender.to_string() })
                        .with_source(source_string.clone())
                        .with_json_payload(&MessageEventPayload {
                            message_type: m.content.message_type(),
                            sender_is_bot: is_proposals_bot,
                        })
                        .build(),
                )
            } else {
                None
            }
        });

        state.data.event_sink_client.push_many(events_iter, false);
    });
}

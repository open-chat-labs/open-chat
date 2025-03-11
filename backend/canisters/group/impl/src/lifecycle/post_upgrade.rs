use crate::activity_notifications::handle_activity_notification;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::{MessageContentInternal, PushMessageArgs, Reader, TextContentInternal};
use constants::{DAY_IN_MS, OPENCHAT_BOT_USER_ID};
use group_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use rand::Rng;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    mutate_state(|state| {
        if !state.data.chat.is_public.value {
            return;
        }

        let now = state.env.now();
        let one_year_ago = now.saturating_sub(365 * DAY_IN_MS);
        if state
            .data
            .chat
            .events
            .main_events_reader()
            .latest_message_event(None)
            .map(|m| m.timestamp)
            .unwrap_or_default()
            < one_year_ago
        {
            state.data.chat.events.push_message(
                PushMessageArgs {
                    sender: OPENCHAT_BOT_USER_ID,
                    thread_root_message_index: None,
                    message_id: state.env.rng().gen(),
                    content: MessageContentInternal::Text(TextContentInternal {
                        text: "This public group has been dormant for over a year.
If there are no new messages in the next 30 days then this group will be deleted."
                            .to_string(),
                    }),
                    bot_context: None,
                    mentioned: Vec::new(),
                    replies_to: None,
                    forwarded: false,
                    sender_is_bot: true,
                    block_level_markdown: false,
                    correlation_id: 0,
                    now,
                },
                Some(&mut state.data.event_store_client),
            );
            ic_cdk_timers::set_timer(Duration::ZERO, || {
                mutate_state(handle_activity_notification);
            });
        }
    });
}

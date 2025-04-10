use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::updates::c2c_delete_group::delete_group;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::Reader;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use notifications_canister_c2c_client::NotificationPusherState;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    data.notifications_queue.set_state(NotificationPusherState {
        notifications_canister: data.notifications_canister_id,
        authorizer: data.local_group_index_canister_id,
    });

    if should_delete_group(&data) {
        ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::futures::spawn(delete_group_async()));
    }

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
}

// In release 2.0.1634 on 11/03/2025 we posted in groups which had been dormant for at least a year
// stating that they would be deleted in 30 days if they had still received no new messages.
// This function returns true if the latest message is still that notice.
fn should_delete_group(data: &Data) -> bool {
    data.chat
        .events
        .main_events_reader()
        .latest_message_event(None)
        .is_some_and(|m| {
            m.event.sender == OPENCHAT_BOT_USER_ID
                && m.event
                    .content
                    .text()
                    .is_some_and(|t| t.contains("This public group has been dormant for over a year"))
        })
}

async fn delete_group_async() {
    let (group_index_canister_id, group_name, members) = read_state(|state| {
        (
            state.data.group_index_canister_id,
            state.data.chat.name.value.clone(),
            state.data.chat.members.member_ids().iter().copied().collect(),
        )
    });

    let args = group_index_canister::c2c_delete_group::Args {
        deleted_by: OPENCHAT_BOT_USER_ID,
        group_name,
        members,
    };

    delete_group(group_index_canister_id, &args).await;
}

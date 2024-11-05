use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_chat_events_memory, get_upgrades_memory};
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::Timestamped;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    chat_events::ChatEvents::init_stable_storage(get_chat_events_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    assert!(data.stable_memory_event_migration_complete);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    // For all members of all public channels of private communities set `notifications_muted` to false
    // if they have not changed the default which was true and is now false.
    mutate_state(|state| {
        if !state.data.is_public {
            let now = state.env.now();
            for channel in state.data.channels.iter_mut().filter(|c| c.chat.is_public.value) {
                for member in channel.chat.members.iter_mut() {
                    if member.notifications_muted.value && member.notifications_muted.timestamp == member.date_added {
                        member.notifications_muted = Timestamped::new(false, now);
                    }
                }
            }
        }
    });
}

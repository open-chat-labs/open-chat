use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::{MarkVideoCallEndedJob, TimerJob};
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use chat_events::Reader;
use community_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use utils::time::HOUR_IN_MS;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

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

    mutate_state(|state| {
        let now = state.env.now();
        for channel in state.data.channels.iter_mut() {
            if channel.chat.events.video_call_in_progress().timestamp < now.saturating_sub(HOUR_IN_MS) {
                if let Some(message_id) = channel
                    .chat
                    .events
                    .video_call_in_progress()
                    .value
                    .as_ref()
                    .map(|vc| vc.message_index)
                    .and_then(|index| {
                        channel
                            .chat
                            .events
                            .main_events_reader()
                            .message_internal(index.into())
                            .map(|m| m.message_id)
                    })
                {
                    state.data.timer_jobs.enqueue_job(
                        TimerJob::MarkVideoCallEnded(MarkVideoCallEndedJob(community_canister::end_video_call::Args {
                            channel_id: channel.id,
                            message_id,
                        })),
                        now,
                        now,
                    );
                }
            }
        }
    });
}

use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::timer_job_types::{ProcessReportClassification, TimerJob};
use crate::{Data, mutate_state};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // Resume any report classifications which were in-flight when the canister was upgraded,
    // cancelling any queued retry jobs so that each pending classification has exactly one job
    mutate_state(|state| {
        let pending = state.data.reported_messages.pending_classification_report_indexes();
        if !pending.is_empty() {
            state
                .data
                .timer_jobs
                .cancel_jobs(|job| matches!(job, TimerJob::ProcessReportClassification(_)));

            let now = state.env.now();
            for report_index in pending {
                state.data.timer_jobs.enqueue_job(
                    TimerJob::ProcessReportClassification(ProcessReportClassification { report_index }),
                    now,
                    now,
                );
            }
        }
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}

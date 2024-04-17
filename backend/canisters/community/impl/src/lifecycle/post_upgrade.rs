use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::PendingCryptoTransaction;
use utils::time::{DAY_IN_MS, NANOS_PER_MILLISECOND};

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
        for channel in state.data.channels.iter_mut() {
            channel.chat.events.set_block_level_markdown(1710152259000);
        }

        for (_, job) in state.data.timer_jobs.iter() {
            if let Some(TimerJob::MakeTransfer(j)) = job.borrow_mut().as_mut() {
                if let PendingCryptoTransaction::ICRC1(t) = &mut j.pending_transaction {
                    let now_nanos = state.env.now_nanos();

                    if t.created + (DAY_IN_MS * NANOS_PER_MILLISECOND) < now_nanos {
                        t.created = now_nanos;
                    }
                }
            }
        }
    });
}

use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::ProcessTokenSwapJob;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_timer_jobs::Job;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use user_canister::post_upgrade::Args;

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

    let windoge_swaps_failed_due_to_fee_change: Vec<_> = read_state(|state| {
        state
            .data
            .token_swaps
            .iter()
            .filter(|s| {
                s.started > 1705000000000
                    && s.success.is_none()
                    && s.args.output_token.ledger == CanisterId::from_text("rh2pm-ryaaa-aaaan-qeniq-cai").unwrap()
                    && s.args.output_token.fee != 100_000
            })
            .cloned()
            .collect()
    });

    for mut token_swap in windoge_swaps_failed_due_to_fee_change {
        token_swap.args.output_token.fee = 100_000;
        ic_cdk_timers::set_timer(Duration::ZERO, || {
            let job = ProcessTokenSwapJob { token_swap, attempt: 0 };
            job.execute();
        });
    }
}

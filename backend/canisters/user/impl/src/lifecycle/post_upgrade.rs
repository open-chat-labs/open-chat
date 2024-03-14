use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::{ProcessTokenSwapJob, TimerJob};
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
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

    mutate_state(|state| {
        let dragginz_ledger = CanisterId::from_text("zfcdd-tqaaa-aaaaq-aaaga-cai").unwrap();
        for swap in state.data.token_swaps.iter_mut().filter(|s| {
            s.args.output_token.ledger == dragginz_ledger
                && s.args.output_token.fee == 1000
                && s.withdrawn_from_dex_at.as_ref().is_some_and(|r| r.is_err())
        }) {
            let now = state.env.now();
            swap.args.output_token.fee = 100000;
            swap.withdrawn_from_dex_at = None;

            state.data.timer_jobs.enqueue_job(
                TimerJob::ProcessTokenSwap(Box::new(ProcessTokenSwapJob {
                    token_swap: swap.clone(),
                    attempt: 0,
                })),
                now,
                now,
            );
        }
    })
}

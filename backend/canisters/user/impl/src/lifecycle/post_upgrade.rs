use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::timer_job_types::{ProcessTokenSwapJob, TimerJob};
use crate::{mutate_state, Data, RuntimeState};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Empty, Milliseconds};
use user_canister::post_upgrade::Args;
use user_canister::swap_tokens::ExchangeArgs;
use utils::time::DAY_IN_MS;

const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;

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
        if state.data.user_created + SIX_MONTHS < state.env.now()
            && state.data.direct_chats.len() <= 1
            && state.data.group_chats.len() == 0
            && state.data.communities.len() == 0
        {
            ic_cdk_timers::set_timer(Duration::ZERO, mark_user_canister_empty);
        }
    });

    mutate_state(retry_token_swaps);
}

fn mark_user_canister_empty() {
    mutate_state(|state| {
        let user_index_canister_id = state.data.user_index_canister_id;
        state.data.fire_and_forget_handler.send(
            user_index_canister_id,
            "c2c_mark_user_canister_empty_msgpack",
            msgpack::serialize_then_unwrap(Empty {}),
        );
    })
}

fn retry_token_swaps(state: &mut RuntimeState) {
    for swap in state.data.token_swaps.iter() {
        // Retry swaps that didn't finish
        // Only try ICPSwap until Sonic fixes their API
        if swap.success.is_none() && matches!(swap.args.exchange_args, ExchangeArgs::ICPSwap(_)) {
            info!(swap_id = %swap.args.swap_id, "Queue incomplete swap");

            let now = state.env.now();
            state.data.timer_jobs.enqueue_job(
                TimerJob::ProcessTokenSwap(Box::new(ProcessTokenSwapJob {
                    token_swap: swap.clone(),
                    attempt: 0,
                    debug: true,
                })),
                now,
                now,
            );
        }
    }
}

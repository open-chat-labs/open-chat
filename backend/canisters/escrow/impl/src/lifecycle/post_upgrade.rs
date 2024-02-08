use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::mutate_state;
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use escrow_canister::post_upgrade::Args;
use escrow_canister::SwapStatus;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    let sneed_ledger = CanisterId::from_text("r7cp6-6aaaa-aaaag-qco5q-cai").unwrap();

    mutate_state(|state| {
        let now = state.env.now();
        for swap in state
            .data
            .swaps
            .iter()
            .filter(|s| !s.token0_received && matches!(s.status(now), SwapStatus::Expired(_)) && s.refunds.is_empty())
        {
            if let Some((accepted_by, _)) = swap.accepted_by {
                state.data.pending_payments_queue.push(PendingPayment {
                    user_id: accepted_by,
                    timestamp: now,
                    token_info: swap.token1.clone(),
                    amount: swap.amount1,
                    swap_id: swap.id,
                    reason: PendingPaymentReason::Refund,
                });
            }

            if swap.token0.ledger == sneed_ledger {
                state.data.pending_payments_queue.push(PendingPayment {
                    user_id: swap.created_by,
                    timestamp: now,
                    token_info: swap.token0.clone(),
                    amount: swap.amount0,
                    swap_id: swap.id,
                    reason: PendingPaymentReason::Refund,
                });
            }
        }
        crate::jobs::make_pending_payments::start_job_if_required(state);
    });
}

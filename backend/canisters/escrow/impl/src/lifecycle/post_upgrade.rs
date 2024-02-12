use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use escrow_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use types::UserId;
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

    mutate_state(|state| {
        let now = state.env.now();
        if let Some(swap) = state.data.swaps.get_mut(107) {
            state.data.pending_payments_queue.push(PendingPayment {
                user_id: UserId::from(Principal::from_text("vfhvn-qyaaa-aaaaf-adoxa-cai").unwrap()),
                timestamp: now,
                token_info: swap.token1.clone(),
                amount: swap.amount1 - swap.token1.fee,
                swap_id: swap.id,
                reason: PendingPaymentReason::Refund,
            });
        }
        if let Some(swap) = state.data.swaps.get_mut(148) {
            state.data.pending_payments_queue.push(PendingPayment {
                user_id: UserId::from(Principal::from_text("mzhg4-fqaaa-aaaar-ay7iq-cai").unwrap()),
                timestamp: now,
                token_info: swap.token1.clone(),
                amount: swap.amount1 - swap.token1.fee,
                swap_id: swap.id,
                reason: PendingPaymentReason::Refund,
            });
        }
    });
}

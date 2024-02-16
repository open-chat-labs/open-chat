use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::model::translations::TranslationStatus;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use translations_canister::post_upgrade::Args;
use types::Cryptocurrency;
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

    ic_cdk_timers::set_timer(Duration::ZERO, || ic_cdk::spawn(retry_failed_payments()));
}

async fn retry_failed_payments() {
    let cutoff = 1708072097452u64;

    mutate_state(|state| {
        let now = state.env.now();

        for translation in state.data.translations.iter().filter(|t| {
            matches!(&t.status,
            TranslationStatus::Approved(a) if a.attribution.when <= cutoff)
        }) {
            state.data.pending_payments_queue.push(PendingPayment {
                recipient_account: translation.proposed.who.into(),
                timestamp: now,
                currency: Cryptocurrency::CHAT,
                amount: 100_000_000, // 1 CHAT
                reason: PendingPaymentReason::Approval,
            });
        }

        crate::jobs::make_pending_payments::start_job_if_required(state);
    });
}

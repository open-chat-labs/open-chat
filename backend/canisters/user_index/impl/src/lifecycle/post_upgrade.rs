use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use icrc_ledger_types::icrc1::account::Account;
use rand::Rng;
use stable_memory::get_reader;
use tracing::info;
use types::Cryptocurrency;
use user_index_canister::post_upgrade::Args;
use utils::consts::SNS_GOVERNANCE_CANISTER_ID;
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

    // Post upgrade - remove
    mutate_state(|state| {
        if !state.data.legacy_principals_synced && state.data.test_mode {
            state.data.legacy_principals_synced = true;
            state
                .data
                .legacy_principals_sync_queue
                .extend(state.data.users.iter().map(|u| u.principal));

            crate::jobs::sync_legacy_user_principals::start_job_if_required(state);
        }

        // Transfer previously raised funds to the treasury
        state.data.pending_payments_queue.push(PendingPayment {
            amount: 365285570000,
            currency: Cryptocurrency::InternetComputer,
            timestamp: state.env.now_nanos(),
            recipient_account: Account::from(SNS_GOVERNANCE_CANISTER_ID),
            memo: state.env.rng().gen(),
            reason: PendingPaymentReason::Treasury,
        });
        crate::jobs::make_pending_payments::start_job_if_required(state);
    });
}

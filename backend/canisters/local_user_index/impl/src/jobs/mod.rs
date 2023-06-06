use crate::RuntimeState;

pub mod make_btc_miami_payments;
pub mod sync_events_to_user_canisters;
pub mod sync_events_to_user_index_canister;
pub mod topup_canister_pool;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    make_btc_miami_payments::start_job_if_required(state);
    sync_events_to_user_canisters::start_job_if_required(state);
    sync_events_to_user_index_canister::start_job_if_required(state);
    topup_canister_pool::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
}

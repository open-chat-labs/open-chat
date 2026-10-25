use crate::RuntimeState;
pub mod make_pending_payments;
pub mod refresh_registry_tokens;
pub mod reset_leaderboard;
pub mod upgrade_canisters;

pub(crate) fn start(state: &RuntimeState) {
    make_pending_payments::start_job_if_required(state);
    upgrade_canisters::start_job_if_required(state);
    reset_leaderboard::start_job_if_required(state);
    refresh_registry_tokens::start_job();
}

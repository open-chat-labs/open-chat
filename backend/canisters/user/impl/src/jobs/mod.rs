use crate::RuntimeState;

pub(crate) mod push_user_canister_events;

pub(crate) fn start(state: &RuntimeState) {
    push_user_canister_events::start_job_if_required(state);
}

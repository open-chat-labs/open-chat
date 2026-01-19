use crate::RuntimeState;

mod remove_inactive_subscriptions;

pub(crate) fn start(_state: &RuntimeState) {
    remove_inactive_subscriptions::start_job();
}

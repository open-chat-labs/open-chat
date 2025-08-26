use crate::RuntimeState;

pub mod expire_members;
pub mod garbage_collect_stable_memory;
pub mod make_pending_payments;
pub mod process_expire_member_actions;

pub(crate) fn start(state: &RuntimeState) {
    expire_members::start_job_if_required(state);
    garbage_collect_stable_memory::start_job_if_required(state);
    make_pending_payments::start_job_if_required(state);
    process_expire_member_actions::start_job_if_required(state);
}

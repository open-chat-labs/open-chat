use ic_cdk::heartbeat;

#[heartbeat]
fn heartbeat() {
    remove_expired_files::run();
}

mod remove_expired_files {
    use crate::{mutate_state, EventToSync};

    pub fn run() {
        mutate_state(|state| {
            let now = state.env.now();
            for file in state.data.files.remove_expired_files(now, 10) {
                state.data.index_sync_state.enqueue(EventToSync::FileRemoved(file));
            }
            crate::jobs::sync_index::start_job_if_required(&state.data);
        });
    }
}

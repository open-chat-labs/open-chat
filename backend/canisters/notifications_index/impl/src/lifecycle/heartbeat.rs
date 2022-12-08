use ic_cdk_macros::heartbeat;

#[heartbeat]
fn heartbeat() {
    sync_notifications_canisters::run();
    cycles_dispenser_client::run();
}

mod sync_notifications_canisters {
    use crate::{mutate_state, RuntimeState};
    use notifications_index_canister::NotificationsIndexEvent;
    use types::CanisterId;

    const MAX_BATCH_SIZE: usize = 1000;

    pub fn run() {
        let batches = mutate_state(get_next);
    }

    fn get_next(runtime_state: &mut RuntimeState) -> Vec<(CanisterId, Vec<NotificationsIndexEvent>)> {
        let batches: Vec<_> = runtime_state
            .data
            .notifications_canisters
            .iter()
            .filter(|c| !c.sync_in_progress())
            .collect();

        vec![]
    }
}

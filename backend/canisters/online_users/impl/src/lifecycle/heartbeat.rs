use crate::{mutate_state, RuntimeState};
use candid::Principal;
use ic_cdk_macros::heartbeat;
use types::CanisterId;

#[heartbeat]
fn heartbeat() {
    flush_online_users::run();
    cycles_dispenser_client::run();
}

mod flush_online_users {
    use super::*;

    pub fn run() {
        if let Some(result) = mutate_state(prepare) {
            ic_cdk::spawn(send_to_user_index(result.user_index_canister_id, result.online_users));
        }
    }

    struct PrepareResult {
        online_users: Vec<Principal>,
        user_index_canister_id: CanisterId,
    }

    fn prepare(runtime_state: &mut RuntimeState) -> Option<PrepareResult> {
        let online_users = runtime_state.data.online_users.take();

        if online_users.is_empty() {
            None
        } else {
            Some(PrepareResult {
                online_users,
                user_index_canister_id: runtime_state.data.user_index_canister_id,
            })
        }
    }

    async fn send_to_user_index(user_index_canister_id: CanisterId, users: Vec<Principal>) {
        let args = user_index_canister::c2c_mark_users_online::Args { users };
        let response = user_index_canister_c2c_client::c2c_mark_users_online(user_index_canister_id, &args).await;

        let success = matches!(response, Ok(user_index_canister::c2c_mark_users_online::Response::Success));

        mutate_state(|state| mark_batch_outcome(success, state));
    }

    fn mark_batch_outcome(success: bool, runtime_state: &mut RuntimeState) {
        runtime_state.data.batches_sent_to_user_index += 1;

        if !success {
            runtime_state.data.failed_batches += 1;
        }
    }
}

use crate::model::callbacks::{Callback, FailedCallback};
use crate::mutate_state;
use ic_cdk_macros::heartbeat;
use utils::time::MINUTE_IN_MS;

#[heartbeat]
fn heartbeat() {
    execute_callbacks::run();
}

mod execute_callbacks {
    use super::*;

    const MAX_CALLBACKS_PER_BLOCK: usize = 5;

    pub fn run() {
        let callbacks = mutate_state(|state| {
            let now = state.env.now();
            state.data.callbacks.take_next_due(now, MAX_CALLBACKS_PER_BLOCK)
        });

        if !callbacks.is_empty() {
            ic_cdk::spawn(execute_callbacks(callbacks));
        }
    }

    async fn execute_callbacks(callbacks: Vec<Callback>) {
        futures::future::join_all(callbacks.into_iter().map(execute_callback)).await;
    }

    async fn execute_callback(callback: Callback) {
        match ic_cdk::api::call::call_raw(callback.canister_id, &callback.method_name, callback.payload.as_ref(), 0).await {
            Ok(_) => mutate_state(|state| state.data.callbacks.record_callback_completed()),
            Err((_, error_message)) => {
                // If it failed due to the target canister being stopped, try again in 1 minute
                if !callback.is_retry && error_message.to_uppercase().contains("STOPPED") {
                    let retry = Callback {
                        canister_id: callback.canister_id,
                        method_name: callback.method_name,
                        payload: callback.payload,
                        is_retry: true,
                    };
                    mutate_state(|state| {
                        let now = state.env.now();
                        state.data.callbacks.add(retry, now + MINUTE_IN_MS);
                    })
                } else {
                    mutate_state(|state| {
                        let now = state.env.now();
                        let failed_callback = FailedCallback {
                            timestamp: now,
                            callback,
                            error_message,
                        };
                        state.data.callbacks.record_failed_callback(failed_callback);
                    })
                }
            }
        }
    }
}

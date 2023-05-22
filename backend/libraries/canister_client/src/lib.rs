use candid::Principal;
use ic_cdk::api::call::{CallResult, RejectionCode};
use std::fmt::Debug;

pub use canister_client_macros::*;

pub async fn make_c2c_call<A, R, S, D, SError: Debug, DError: Debug>(
    canister_id: Principal,
    method_name: &str,
    args: A,
    serializer: S,
    deserializer: D,
) -> CallResult<R>
where
    S: Fn(A) -> Result<Vec<u8>, SError>,
    D: Fn(&[u8]) -> Result<R, DError>,
{
    let payload_bytes =
        serializer(args).map_err(|e| (RejectionCode::CanisterError, format!("Serialization error: {:?}", e)))?;

    let response_bytes = make_c2c_call_raw(canister_id, method_name, &payload_bytes).await?;

    deserializer(&response_bytes).map_err(|e| (RejectionCode::CanisterError, format!("Deserialization error: {:?}", e)))
}

pub async fn make_c2c_call_raw(canister_id: Principal, method_name: &str, payload_bytes: &[u8]) -> CallResult<Vec<u8>> {
    tracing::trace!(method_name, %canister_id, "Starting c2c call");

    let response = ic_cdk::api::call::call_raw(canister_id, method_name, payload_bytes, 0).await;

    match response {
        Ok(response_bytes) => {
            tracing::trace!(method_name, %canister_id, "Completed c2c call successfully");
            Ok(response_bytes)
        }
        Err((error_code, error_message)) => {
            tracing::error!(method_name, %canister_id, ?error_code, error_message, "Error calling c2c");
            Err((error_code, error_message))
        }
    }
}

#[macro_export]
macro_rules! MakeC2CCallJob {
    () => {
        #[derive(serde::Serialize, serde::Deserialize, Clone)]
        pub struct MakeC2CCallJob {
            pub canister_id: types::CanisterId,
            pub method_name: String,
            pub payload: Vec<u8>,
            pub attempt: u32,
        }

        impl Job for MakeC2CCallJob {
            fn execute(&self) {
                async fn execute_async(mut job: MakeC2CCallJob) {
                    if canister_client::make_c2c_call_raw(job.canister_id, &job.method_name, &job.payload)
                        .await
                        .is_err()
                        && job.attempt < 50
                    {
                        mutate_state(|state| {
                            let now = state.env.now();
                            let due = now + (u64::from(job.attempt) * utils::time::SECOND_IN_MS);
                            job.attempt += 1;
                            state.data.timer_jobs.enqueue_job(TimerJob::MakeC2CCall(job), due, now);
                        })
                    }
                }

                ic_cdk::spawn(execute_async(self.clone()));
            }
        }
    };
}

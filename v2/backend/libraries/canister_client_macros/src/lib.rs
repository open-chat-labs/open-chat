#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &candid::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, ic_agent::AgentError> {
            use candid::{Decode, Encode};

            let method_name = stringify!($method_name);
            let response = agent
                .update(canister_id, method_name)
                .with_arg(Encode!(args).expect(&format!("Failed to serialize '{}' args", method_name)))
                .call_and_wait(delay())
                .await?;

            Ok(Decode!(response.as_slice(), $method_name::Response)
                .expect(&format!("Failed to deserialize '{}' response", method_name)))
        }
    };
}

#[macro_export]
macro_rules! generate_query_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &candid::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, ic_agent::AgentError> {
            use candid::{Decode, Encode};

            let method_name = stringify!($method_name);
            let response = agent
                .query(canister_id, method_name)
                .with_arg(Encode!(args).expect(&format!("Failed to serialize '{}' args", method_name)))
                .call()
                .await?;

            Ok(Decode!(response.as_slice(), $method_name::Response)
                .expect(&format!("Failed to deserialize '{}' response", method_name)))
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: types::CanisterId, args: &$method_name::Args) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = stringify!($method_name);
            let result: ic_cdk::api::call::CallResult<($method_name::Response,)> = ic_cdk::call(canister_id, method_name, (args,)).await;

            if let Err(error) = &result {
                tracing::error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
            }

            result.map(|r| r.0)
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call_with_cycles {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: types::CanisterId, args: &$method_name::Args, cycles: types::Cycles) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            use std::convert::TryInto;

            let method_name = stringify!($method_name);
            let result: ic_cdk::api::call::CallResult<($method_name::Response,)> =
                ic_cdk::api::call::call_with_payment(canister_id, method_name, (args,), cycles.try_into().unwrap()).await;

            if let Err(error) = &result {
                tracing::error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
            }

            result.map(|r| r.0)
        }
    };
}

#[cfg(feature = "garcon")]
// How `Agent` is instructed to wait for update calls.
pub fn delay() -> garcon::Delay {
    garcon::Delay::builder()
        .throttle(std::time::Duration::from_millis(500))
        .timeout(std::time::Duration::from_secs(60 * 5))
        .build()
}

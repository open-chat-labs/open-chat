#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            agent: &ic_agent::Agent,
            canister_id: &candid::Principal,
            args: &$method_name::Args,
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + Sync + std::marker::Send>> {
            use candid::{Decode, Encode};

            let candid_args = Encode!(args)?;

            let method_name = stringify!($method_name);
            let response = agent
                .update(canister_id, method_name)
                .with_arg(candid_args)
                .call_and_wait(delay())
                .await?;

            let result = Decode!(response.as_slice(), $method_name::Response)?;
            Ok(result)
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
        ) -> Result<$method_name::Response, Box<dyn std::error::Error + std::marker::Send + std::marker::Sync>> {
            use candid::{Decode, Encode};

            let candid_args = Encode!(args)?;

            let method_name = stringify!($method_name);
            let response = agent
                .query(canister_id, method_name)
                .with_arg(candid_args)
                .call()
                .await?;

            Ok(Decode!(response.as_slice(), $method_name::Response)?)
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: types::CanisterId, args: &$method_name::Args) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = concat!(stringify!($method_name), "_msgpack");
            let payload_bytes = msgpack::serialize(args);

            let result = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

            if let Err(error) = &result {
                tracing::error!(method_name, error_code = ?error.0, error_message = error.1.as_str(), "Error calling c2c");
            }

            result.map(|r| msgpack::deserialize(&r))
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

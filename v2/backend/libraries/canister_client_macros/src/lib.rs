#[macro_export]
macro_rules! generate_update_call {
    ($method_name:ident) => {
        pub async fn $method_name(agent: &Agent, canister_id: &Principal, args: &$method_name::Args) -> $method_name::Response {
            let method_name = stringify!($method_name);
            let response = agent
                .update(canister_id, method_name)
                .with_arg(Encode!(args).expect(&format!("Failed to serialize '{}' args", method_name)))
                .call_and_wait(delay())
                .await
                .expect(&format!("Failed to call '{}'", method_name));

            Decode!(response.as_slice(), $method_name::Response)
                .expect(&format!("Failed to deserialize '{}' response", method_name))
        }
    };
}

#[macro_export]
macro_rules! generate_query_call {
    ($method_name:ident) => {
        pub async fn $method_name(agent: &Agent, canister_id: &Principal, args: &$method_name::Args) -> $method_name::Response {
            let method_name = stringify!($method_name);
            let response = agent
                .query(canister_id, method_name)
                .with_arg(Encode!(args).expect(&format!("Failed to serialize '{}' args", method_name)))
                .call()
                .await
                .expect(&format!("Failed to call '{}'", method_name));

            Decode!(response.as_slice(), $method_name::Response)
                .expect(&format!("Failed to deserialize '{}' response", method_name))
        }
    };
}

#[macro_export]
macro_rules! generate_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: CanisterId, args: &$method_name::Args) -> CallResult<$method_name::Response> {
            let method_name = stringify!($method_name);
            let result: CallResult<($method_name::Response,)> = ic_cdk::call(canister_id, method_name, (args,)).await;

            if let Err(error) = &result {
                error!("Error calling '{}': {:?}: {}", method_name, error.0, error.1);
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

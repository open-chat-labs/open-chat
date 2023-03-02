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
                .call_and_wait()
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
        pub async fn $method_name(
            canister_id: types::CanisterId,
            args: &$method_name::Args,
        ) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = concat!(stringify!($method_name), "_msgpack");
            let payload_bytes = msgpack::serialize(args).map_err(|e| {
                (
                    ic_cdk::api::call::RejectionCode::CanisterError,
                    format!("Serialization error: {:?}", e),
                )
            })?;

            tracing::trace!(method_name, %canister_id, "Starting c2c call");

            let result = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

            match result {
                Ok(response) => {
                    tracing::trace!(method_name, %canister_id, "Completed c2c call successfully");
                    msgpack::deserialize(&response).map_err(|e| {
                        (
                            ic_cdk::api::call::RejectionCode::CanisterError,
                            format!("Deserialization error: {:?}", e),
                        )
                    })
                },
                Err((error_code, error_message)) => {
                    tracing::error!(method_name, %canister_id, ?error_code, error_message, "Error calling c2c");
                    Err((error_code, error_message))
                }
            }
        }
    };
}

#[macro_export]
macro_rules! generate_candid_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(
            canister_id: types::CanisterId,
            args: &$method_name::Args,
        ) -> ic_cdk::api::call::CallResult<$method_name::Response> {
            let method_name = stringify!($method_name);
            let payload_bytes = candid::encode_one(args).map_err(|e| {
                (
                    ic_cdk::api::call::RejectionCode::CanisterError,
                    format!("Serialization error: {:?}", e),
                )
            })?;

            tracing::trace!(method_name, %canister_id, "Starting c2c call");

            let result = ic_cdk::api::call::call_raw(canister_id, method_name, &payload_bytes, 0).await;

            match result {
                Ok(response) => {
                    tracing::trace!(method_name, %canister_id, "Completed c2c call successfully");
                    candid::decode_one(&response).map_err(|e| {
                        (
                            ic_cdk::api::call::RejectionCode::CanisterError,
                            format!("Deserialization error: {:?}", e),
                        )
                    })
                },
                Err((error_code, error_message)) => {
                    tracing::error!(method_name, %canister_id, ?error_code, error_message, "Error calling c2c");
                    Err((error_code, error_message))
                }
            }
        }
    };
}

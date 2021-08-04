#[macro_export]
macro_rules! generate_c2c_call {
    ($method_name:ident) => {
        pub async fn $method_name(canister_id: CanisterId, args: &$method_name::Args) -> CallResult<($method_name::Response,)> {
            let method_name = stringify!($method_name);
            let result: CallResult<($method_name::Response,)> = ic_cdk::call(canister_id, method_name, (args,)).await;

            if let Err(error) = &result {
                error!("Error calling '{}': {:?}: {}", method_name, error.0, error.1);
            }

            result
        }
    };
}

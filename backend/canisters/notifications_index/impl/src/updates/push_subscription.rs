use crate::mutate_state;
use crate::updates::{LookupError, get_user_id};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::push_subscription::{Response::*, *};

#[update(msgpack = true)]
#[trace]
async fn push_subscription(args: Args) -> Response {
    match get_user_id().await {
        Ok(user_id) => {
            mutate_state(|state| state.add_subscription(user_id, args.subscription, state.env.now()));
            Success
        }
        Err(LookupError::UserNotFound) => panic!("User not found"),
        Err(LookupError::InternalError(err)) => {
            // TODO log/trace internal error
            InternalError(format!("Failed to call 'user_index::c2c_lookup_user': {err:?}"))
        }
    }
}

use crate::mutate_state;
use crate::updates::get_user_id;
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
        Err(err) => InternalError(format!("{err:?}")),
    }
}

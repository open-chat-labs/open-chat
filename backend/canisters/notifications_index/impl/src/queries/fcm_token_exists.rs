use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use notifications_index_canister::fcm_token_exists::{Args, Response};

#[query(msgpack = true)]
fn fcm_token_exists(args: Args) -> Response {
    read_state(|state| fcm_token_exists_impl(args, state))
}

fn fcm_token_exists_impl(args: Args, state: &RuntimeState) -> Response {
    Response(state.data.fcm_token_store.contains(&args.fcm_token))
}

use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use notifications_index_canister::subscription_exists::{Response::*, *};

#[query(msgpack = true)]
fn subscription_exists(args: Args) -> Response {
    read_state(|state| subscription_exists_impl(args, state))
}

fn subscription_exists_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(user_id) = state.data.principal_to_user_id_map.get(&caller) {
        match state.data.subscriptions.exists(&user_id, args.p256dh_key) {
            true => Yes,
            false => No,
        }
    } else {
        No
    }
}

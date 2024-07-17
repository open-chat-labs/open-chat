use crate::guards::caller_is_local_user_index;
use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use types::Milliseconds;
use user_canister::c2c_is_empty_and_dormant::*;
use utils::time::DAY_IN_MS;

const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_is_empty_and_dormant(_args: Args) -> Response {
    read_state(is_empty_and_dormant_impl)
}

fn is_empty_and_dormant_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();

    state.data.user_created + SIX_MONTHS < now
        && state.data.direct_chats.len() <= 1
        && state.data.group_chats.len() == 0
        && state.data.communities.len() == 0
}

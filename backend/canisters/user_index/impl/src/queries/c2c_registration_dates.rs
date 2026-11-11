use crate::guards::caller_is_local_user_index_canister;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use user_index_canister::c2c_registration_dates::{Response::*, *};

// Lets each LocalUserIndex fill in the registration dates of users it holds without one
#[query(guard = "caller_is_local_user_index_canister", msgpack = true)]
fn c2c_registration_dates(args: Args) -> Response {
    read_state(|state| c2c_registration_dates_impl(args, state))
}

fn c2c_registration_dates_impl(args: Args, state: &RuntimeState) -> Response {
    Success(
        args.user_ids
            .into_iter()
            .filter_map(|user_id| {
                state
                    .data
                    .users
                    .get_by_user_id(&user_id)
                    .filter(|u| u.date_created > 0)
                    .map(|u| (user_id, u.date_created))
            })
            .collect(),
    )
}

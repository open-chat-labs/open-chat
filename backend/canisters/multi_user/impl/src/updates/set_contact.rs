use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::set_contact::*;
use types::OCResult;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_contact(args: Args) -> Response {
    execute_update(|state| set_contact_impl(args, state)).into()
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_index = state.caller_user_index_or_trap();
    let data = &mut state.data;
    data.users
        .with_user_mut(my_index, |user| {
            user_core::updates::set_contact(user, args, &data.migrated_user_ids)
        })
        .expect("User not found")
}

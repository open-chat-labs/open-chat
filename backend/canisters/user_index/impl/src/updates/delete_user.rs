use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use identity_utils::extract_certificate;
use local_user_index_canister::{DeleteUser, UserIndexEvent};
use user_index_canister::delete_user::{Response::*, *};

#[update(msgpack = true)]
#[trace]
fn delete_user(args: Args) -> Response {
    mutate_state(|state| delete_user_impl(args, state))
}

fn delete_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user) = state.data.users.get_by_user_id(&args.user_id) else {
        return UserNotFound;
    };

    let caller = state.env.caller();
    if caller != user.principal && caller != user.user_id.into() {
        return NotAuthorized;
    }

    let certificate = match extract_certificate(&args.delegation.signature) {
        Ok(c) => c,
        Err(e) => return MalformedSignature(e),
    };

    let now_nanos = state.env.now_nanos() as u128;
    let five_minutes = (5 * MINUTE_IN_MS * NANOS_PER_MILLISECOND) as u128;

    if ic_certificate_verification::validate_certificate_time(&certificate, &now_nanos, &five_minutes).is_err() {
        return DelegationTooOld;
    };

    state.delete_user(args.user_id, true);
    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::DeleteUser(DeleteUser {
            user_id: args.user_id,
            triggered_by_user: true,
        }),
        None,
    );
    Success
}

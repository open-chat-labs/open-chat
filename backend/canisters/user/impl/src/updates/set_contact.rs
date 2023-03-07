use crate::guards::caller_is_owner;
use crate::model::contacts::SetContactResponse;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use user_canister::set_contact::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn set_contact(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| set_contact_impl(args, state))
}

fn set_contact_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    match state.data.contacts.set_contact(args.contact) {
        SetContactResponse::Success => Success,
        SetContactResponse::NoChange => NoChange,
        SetContactResponse::NicknameTooLong(n) => NicknameTooLong(n),
        SetContactResponse::NicknameTooShort(n) => NicknameTooShort(n),
    }
}

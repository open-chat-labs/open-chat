use crate::updates::set_avatar::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use types::{Avatar, FieldTooLongResult, MAX_AVATAR_SIZE};
use user_canister::set_avatar::*;

#[update]
fn set_avatar(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| set_avatar_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn set_avatar_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    if args.data.len() > MAX_AVATAR_SIZE as usize {
        return AvatarTooBig(FieldTooLongResult {
            length_provided: args.data.len() as u32,
            max_length: MAX_AVATAR_SIZE as u32,
        });
    }

    let id = args.id;

    let avatar = Avatar {
        id,
        mime_type: args.mime_type,
        data: args.data,
    };

    runtime_state.data.avatar = Some(avatar);

    Success(id)
}

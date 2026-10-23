use crate::RuntimeState;
use group_canister::SetUserSuspended as Args;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

pub(crate) fn c2c_set_user_suspended_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();
    if state
        .data
        .chat
        .members
        .set_suspended(args.user_id, args.suspended, now)
        .is_some()
    {
        UnitResult::Success
    } else {
        UnitResult::Error(OCErrorCode::TargetUserNotInChat.into())
    }
}

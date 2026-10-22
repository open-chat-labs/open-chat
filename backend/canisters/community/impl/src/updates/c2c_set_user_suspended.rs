use crate::RuntimeState;
use community_canister::SetUserSuspended as Args;
use oc_error_codes::OCErrorCode;
use types::UnitResult;

pub(crate) fn c2c_set_user_suspended_impl(args: Args, state: &mut RuntimeState) -> UnitResult {
    let now = state.env.now();
    if state.data.members.set_suspended(args.user_id, args.suspended, now).is_some() {
        for channel_id in state.data.members.channels_for_member(args.user_id) {
            if let Some(channel) = state.data.channels.get_mut(channel_id) {
                channel.chat.members.set_suspended(args.user_id, args.suspended, now);
            }
        }
        UnitResult::Success
    } else {
        UnitResult::Error(OCErrorCode::TargetUserNotInCommunity.into())
    }
}

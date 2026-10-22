use crate::guards::caller_is_user_index;
use crate::updates::c2c_flag_message::c2c_flag_message_impl;
use crate::updates::c2c_moderation_hard_delete::c2c_moderation_hard_delete_impl;
use crate::updates::c2c_moderation_undelete::c2c_moderation_undelete_impl;
use crate::updates::c2c_set_user_suspended::c2c_set_user_suspended_impl;
use crate::updates::delete_messages::delete_messages_as_platform_moderator;
use crate::{RuntimeState, execute_update_even_if_frozen};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::UserIndexEvent;
use group_canister::c2c_user_index::*;
use types::UnitResult;

// Must be fed by a single queue on the UserIndex, keyed by this canister (a community's channels
// share it): the idempotency check keeps one high-water mark per sender, so a batch retried from a
// second queue after a later batch from the first had landed would be dropped as already seen
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_user_index(args: Args) -> Response {
    execute_update_even_if_frozen(|state| c2c_user_index_impl(args, state))
}

fn c2c_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(state.data.user_index_canister_id, event.created_at, event.idempotency_id)
        {
            // Applied as the endpoint each replaces applied it, whose reply the UserIndex never read
            let _: UnitResult = match event.value {
                UserIndexEvent::FlagMessage(ev) => c2c_flag_message_impl(ev, state).into(),
                // Applied in a frozen chat too, as a flag-and-delete takedown is, where `delete_messages`
                // itself refuses one
                UserIndexEvent::DeleteMessages(ev) => delete_messages_as_platform_moderator(ev, state).into(),
                UserIndexEvent::ModerationUndelete(ev) => c2c_moderation_undelete_impl(ev, state),
                UserIndexEvent::ModerationHardDelete(ev) => c2c_moderation_hard_delete_impl(ev, state),
                UserIndexEvent::SetUserSuspended(ev) => c2c_set_user_suspended_impl(ev, state),
            };
        }
    }
    Response::Success
}

use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::disable_invite_code::*;
use oc_error_codes::OCErrorCode;
use types::{GroupInviteCodeChange, GroupInviteCodeChanged, OCResult};

#[update(msgpack = true)]
#[trace]
fn disable_invite_code(_args: Args) -> Response {
    execute_update(disable_invite_code_impl).into()
}

fn disable_invite_code_impl(state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if member.role().can_invite_users(&state.data.chat.permissions) {
        state.data.invite_code_enabled = false;

        let now = state.env.now();
        state.data.chat.events.push_main_event(
            ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
                change: GroupInviteCodeChange::Disabled,
                changed_by: member.user_id(),
            })),
            now,
        );

        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}

use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_bot::*;
use oc_error_codes::OCErrorCode;
use types::{BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult};

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if !state.data.update_bot(
        member.user_id,
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        state.env.now(),
    ) {
        return Err(OCErrorCode::BotNotFound.into());
    }

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by: member.user_id,
            location: BotInstallationLocation::Community(state.env.canister_id().into()),
            api_gateway: state.data.local_user_index_canister_id,
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
    }));

    handle_activity_notification(state);
    Ok(())
}

use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::update_bot::*;
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

    let installed_by = member.user_id();
    let now = state.env.now();

    if !state.data.update_bot_permissions(
        installed_by,
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        now,
    ) {
        return Err(OCErrorCode::BotNotFound.into());
    }

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by,
            location: BotInstallationLocation::Group(state.env.canister_id().into()),
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    handle_activity_notification(state);
    Ok(())
}

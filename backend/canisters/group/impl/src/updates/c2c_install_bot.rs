use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{BotEvent, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult};
use types::{BotInstallationLocation, c2c_install_bot::*};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    execute_update(|state| c2c_install_bot_impl(args, state)).into()
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.data.chat.members.get_verified_member(args.caller)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let installed_by = member.user_id();

    if !state.data.install_bot(
        installed_by,
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        args.default_subscriptions,
        state.env.now(),
    ) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by,
            location: BotInstallationLocation::Group(state.env.canister_id().into()),
            api_gateway: state.data.local_user_index_canister_id,
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
    }));

    handle_activity_notification(state);
    Ok(())
}

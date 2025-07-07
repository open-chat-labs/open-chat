use crate::guards::caller_is_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{BotAdded, c2c_install_bot::*};
use types::{BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    execute_update(|state| c2c_install_bot_impl(args, state)).into()
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.data.members.get_verified_member(args.caller.into())?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();

    if !state.data.install_bot(
        member.user_id,
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        args.default_subscriptions,
        now,
    ) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    state.push_community_event(CommunityEventInternal::BotAdded(Box::new(BotAdded {
        user_id: args.bot_id,
        added_by: member.user_id,
    })));

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by: member.user_id,
            location: BotInstallationLocation::Community(state.env.canister_id().into()),
            api_gateway: state.data.local_user_index_canister_id,
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    handle_activity_notification(state);
    Ok(())
}

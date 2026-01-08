use crate::guards::caller_is_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{BotAdded, c2c_install_bot, install_bot::*};
use types::{BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult};

#[update(msgpack = true)]
#[trace]
fn install_bot(args: Args) -> Response {
    execute_update(|state| {
        install_bot_impl(
            c2c_install_bot::Args {
                bot_id: args.bot_id,
                caller: state.env.caller().into(),
                granted_permissions: args.granted_permissions,
                granted_autonomous_permissions: args.granted_autonomous_permissions,
                default_subscriptions: args.default_subscriptions,
            },
            state,
        )
    })
    .into()
}

// TODO: remove this once community canisters have been upgraded
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: c2c_install_bot::Args) -> c2c_install_bot::Response {
    execute_update(|state| install_bot_impl(args, state)).into()
}

fn install_bot_impl(args: c2c_install_bot::Args, state: &mut RuntimeState) -> OCResult {
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
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    handle_activity_notification(state);
    Ok(())
}

use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, OCResult};
use user_canister::update_bot::*;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let now = state.env.now();

    if !state.data.update_bot_permissions(
        args.bot_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        now,
    ) {
        return Err(OCErrorCode::BotNotFound.into());
    }

    let installed_by = state.env.canister_id().into();

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by,
            location: BotInstallationLocation::User(installed_by.into()),
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    Ok(())
}

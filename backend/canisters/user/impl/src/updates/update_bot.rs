use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{
    BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, ChatEventCategory, OCResult,
};
use user_canister::update_bot::*;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    let now = state.env.now();

    state
        .data
        .bots
        .update(
            args.bot_id,
            args.granted_permissions.clone(),
            args.granted_autonomous_permissions.clone(),
            now,
        )
        .then_some(())
        .ok_or(OCErrorCode::BotNotFound)?;

    // Subscribe to permitted chat events

    let bot = state.data.bots.get(&args.bot_id).unwrap();
    let subscriptions = bot.default_subscriptions.clone().unwrap_or_default();
    let permissions = args.granted_autonomous_permissions.clone().unwrap_or_default();
    let permitted_categories = permissions.permitted_chat_event_categories_to_read();
    let chat = state.data.direct_chats.get_mut(&args.bot_id.into()).unwrap();

    chat.events.subscribe_bot_to_events(
        args.bot_id,
        subscriptions
            .chat
            .into_iter()
            .filter(|t| permitted_categories.contains(&ChatEventCategory::from(*t)))
            .collect(),
    );

    let installed_by = state.env.canister_id().into();

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by,
            location: BotInstallationLocation::User(installed_by.into()),
            api_gateway: state.data.local_user_index_canister_id,
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
    }));

    Ok(())
}

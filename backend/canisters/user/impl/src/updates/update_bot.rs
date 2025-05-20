use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ChatEventCategory, OCResult};
use user_canister::update_bot::*;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    execute_update(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    state
        .data
        .bots
        .update(
            args.bot_id,
            args.granted_permissions,
            args.granted_autonomous_permissions.clone(),
            state.env.now(),
        )
        .then_some(())
        .ok_or(OCErrorCode::BotNotFound)?;

    // Subscribe to permitted chat events

    let bot = state.data.bots.get(&args.bot_id).unwrap();
    let subscriptions = bot.default_subscriptions.clone().unwrap_or_default();
    let permissions = args.granted_autonomous_permissions.unwrap_or_default();
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

    Ok(())
}

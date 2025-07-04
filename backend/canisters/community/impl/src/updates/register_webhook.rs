use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::register_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::document::try_parse_data_url;

#[update(msgpack = true)]
#[trace]
fn register_webhook(args: Args) -> Response {
    match execute_update(|state| register_webhook_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn register_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_calling_member(true)?.user_id;
    let channel = state.data.channels.get_mut_or_err(&args.channel_id)?;
    let member = channel.chat.members.get_verified_member(user_id)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let avatar = args
        .avatar
        .map(|avatar_url| try_parse_data_url(&avatar_url))
        .transpose()
        .map_err(|_| OCErrorCode::InvalidAvatar)?;

    let now = state.env.now();

    let Some(webhook_id) = channel.chat.webhooks.register(args.name, avatar, state.env.rng(), now) else {
        return Err(OCErrorCode::NameTaken.into());
    };

    let webhook = channel.chat.webhooks.get(&webhook_id).unwrap();

    let result = SuccessResult {
        id: webhook_id,
        secret: webhook.secret.clone(),
        avatar_id: webhook.avatar.as_ref().map(|a| a.id),
    };

    handle_activity_notification(state);

    Ok(result)
}

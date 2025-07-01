use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use utils::document::try_parse_data_url;

#[update(msgpack = true)]
#[trace]
fn update_webhook(args: Args) -> Response {
    execute_update(|state| update_webhook_impl(args, state)).into()
}

fn update_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult {
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

    if !channel.chat.webhooks.update(args.id, args.name, avatar, now) {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    handle_activity_notification(state);
    Ok(())
}

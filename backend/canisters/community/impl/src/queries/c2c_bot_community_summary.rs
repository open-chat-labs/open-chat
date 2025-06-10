use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use community_canister::c2c_bot_community_summary::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotPermissions, CommunityPermission, Document, OCResult};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_community_summary(args: Args) -> Response {
    match read_state(|state| c2c_bot_community_summary_impl(args, state)) {
        Ok(details) => Success(details),
        Err(error) => Error(error),
    }
}

fn c2c_bot_community_summary_impl(args: Args, state: &RuntimeState) -> OCResult<CommunitySummary> {
    if !state.data.is_bot_permitted(
        &args.bot_id,
        None,
        &args.initiator,
        &BotPermissions::from_community_permission(CommunityPermission::ReadSummary),
    ) {
        return Err(OCErrorCode::InitiatorNotFound.into());
    }

    let data = &state.data;

    Ok(CommunitySummary {
        community_id: state.env.canister_id().into(),
        last_updated: data.events.latest_event_timestamp(),
        name: data.name.value.clone(),
        description: data.description.value.clone(),
        avatar_id: Document::id(&data.avatar),
        banner_id: Document::id(&data.banner),
        is_public: data.is_public.value,
        verified: data.verified.value,
        member_count: data.members.len() as u32,
        permissions: data.permissions.value.clone(),
        frozen: data.frozen.value.clone(),
        gate_config: data.gate_config.value.clone().map(|gc| gc.into()),
        primary_language: data.primary_language.value.clone(),
        latest_event_index: data.events.latest_event_index(),
        rules: data.rules.value.clone().into(),
        public_channels: data
            .channels
            .public_channels()
            .into_iter()
            .filter(|c| *c.chat.is_public)
            .map(|c| ChannelSummary {
                channel_id: c.id,
                last_updated: c.details_last_updated(),
                name: c.chat.name.value.clone(),
            })
            .collect(),
    })
}

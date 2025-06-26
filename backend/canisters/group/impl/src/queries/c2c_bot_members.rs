use crate::Data;
use crate::RuntimeState;
use crate::guards::caller_is_local_user_index;
use crate::read_state;
use canister_api_macros::query;
use group_canister::c2c_bot_members::*;
use oc_error_codes::OCErrorCode;
use std::collections::HashMap;
use types::ChatPermission;
use types::GroupRole;
use types::MemberType;
use types::MembersResponse;
use types::MembersResult;
use types::UserId;
use types::{BotPermissions, OCResult};

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_members(args: Args) -> MembersResponse {
    read_state(|state| match c2c_bot_members_impl(args, state) {
        Ok(members) => MembersResponse::Success(members),
        Err(error) => MembersResponse::Error(error),
    })
}

fn c2c_bot_members_impl(args: Args, state: &RuntimeState) -> OCResult<MembersResult> {
    if !state.data.is_bot_permitted(
        &args.bot_id,
        &args.initiator,
        &BotPermissions::from_chat_permission(ChatPermission::ReadMembership),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let mut members_map = HashMap::new();

    for member_type in args.member_types {
        let user_ids = users_by_type(&state.data, member_type);
        if !user_ids.is_empty() {
            members_map.insert(member_type, user_ids);
        }
    }

    Ok(MembersResult { members_map })
}

fn users_by_type(data: &Data, member_type: MemberType) -> Vec<UserId> {
    match member_type {
        MemberType::Owner => data.chat.members.owners().iter().copied().collect(),
        MemberType::Admin => data.chat.members.admins().iter().copied().collect(),
        MemberType::Moderator => data.chat.members.moderators().iter().copied().collect(),
        MemberType::Member => data
            .chat
            .members
            .member_ids()
            .iter()
            .filter(|user_id| matches!(data.chat.members.role(user_id), Some(GroupRole::Participant)))
            .copied()
            .collect(),
        MemberType::Lapsed => data.chat.members.lapsed().iter().copied().collect(),
        MemberType::Blocked => data.chat.members.blocked(),
        MemberType::Invited => data.chat.invited_users.user_ids().copied().collect(),
        MemberType::Bot => data.bots.user_ids().copied().collect(),
        MemberType::Webhook => data.chat.webhooks.user_ids().copied().collect(),
    }
}

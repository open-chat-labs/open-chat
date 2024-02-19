use crate::guards::caller_is_openchat_user;
use crate::{read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::query;
use jwt::VideoCallClaims;
use local_user_index_canister::access_token::{Response::*, *};
use types::{AccessTokenType, CanisterId, ChannelId, Chat, ChatId, CommunityId, UserId};

#[query(composite = true, guard = "caller_is_openchat_user")]
#[trace]
async fn access_token(args: Args) -> Response {
    let (user_id, is_diamond) = match read_state(get_user) {
        Some(p) => p,
        None => return NotAuthorized,
    };

    let start_call = matches!(args.token_type, AccessTokenType::StartVideoCall);

    match args.chat {
        Chat::Direct(chat_id) => {
            let other_user: CanisterId = chat_id.into();
            if (!is_diamond && start_call)
                || !read_state(|state| state.data.global_users.get_by_user_id(&other_user.into()).is_some())
            {
                return NotAuthorized;
            }
        }
        Chat::Group(chat_id) => {
            if let Err(response) = check_group_access(chat_id, user_id, is_diamond, args.token_type).await {
                return response;
            }
        }
        Chat::Channel(community_id, channel_id) => {
            if let Err(response) = check_channel_access(community_id, channel_id, user_id, is_diamond, args.token_type).await {
                return response;
            }
        }
    }

    read_state(|state| build_token(user_id, args.chat, start_call, state))
}

fn get_user(state: &RuntimeState) -> Option<(UserId, bool)> {
    state.data.global_users.get_by_principal(&state.env.caller()).map(|u| {
        (
            u.user_id,
            state.data.global_users.is_diamond_member(&u.user_id, state.env.now()),
        )
    })
}

fn build_token(user_id: UserId, chat: Chat, start_call: bool, state: &RuntimeState) -> Response {
    if let Some(secret_key_der) = state.data.oc_secret_key_der.as_ref() {
        let claims = VideoCallClaims::new(user_id, chat, start_call, state.env.now());

        match jwt::sign_and_encode_token(secret_key_der, claims) {
            Ok(token) => Success(token),
            Err(err) => InternalError(format!("{err:?}")),
        }
    } else {
        InternalError("OC Secret not set".to_string())
    }
}

async fn check_group_access(
    chat_id: ChatId,
    user_id: UserId,
    is_diamond: bool,
    access_type: AccessTokenType,
) -> Result<(), Response> {
    match group_canister_c2c_client::c2c_can_issue_access_token(
        chat_id.into(),
        &group_canister::c2c_can_issue_access_token::Args {
            user_id,
            is_diamond,
            access_type,
        },
    )
    .await
    {
        Ok(response) if response => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

async fn check_channel_access(
    communty_id: CommunityId,
    channel_id: ChannelId,
    user_id: UserId,
    is_diamond: bool,
    access_type: AccessTokenType,
) -> Result<(), Response> {
    match community_canister_c2c_client::c2c_can_issue_access_token_for_channel(
        communty_id.into(),
        &community_canister::c2c_can_issue_access_token_for_channel::Args {
            user_id,
            is_diamond,
            access_type,
            channel_id,
        },
    )
    .await
    {
        Ok(response) if response => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

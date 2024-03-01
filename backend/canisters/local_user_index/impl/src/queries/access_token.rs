use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::query;
use jwt::Claims;
use local_user_index_canister::access_token::{Response::*, *};
use rand::rngs::StdRng;
use rand::SeedableRng;
use types::{AccessTokenType, ChannelId, Chat, ChatId, CommunityId, UserId, VideoCallClaims};

#[query(composite = true, guard = "caller_is_openchat_user")]
#[trace]
async fn access_token(args: Args) -> Response {
    let Some((user_id, is_diamond)) = read_state(get_user) else {
        return NotAuthorized;
    };

    let token_type = args.token_type.clone();

    match args.chat {
        Chat::Direct(chat_id) => {
            if let Err(response) = check_user_access(chat_id, user_id, is_diamond, token_type).await {
                return response;
            }
        }
        Chat::Group(chat_id) => {
            if let Err(response) = check_group_access(chat_id, user_id, is_diamond, token_type).await {
                return response;
            }
        }
        Chat::Channel(community_id, channel_id) => {
            if let Err(response) = check_channel_access(community_id, channel_id, user_id, is_diamond, token_type).await {
                return response;
            }
        }
    }

    mutate_state(|state| build_token(user_id, args, state))
}

fn get_user(state: &RuntimeState) -> Option<(UserId, bool)> {
    state.data.global_users.get_by_principal(&state.env.caller()).map(|u| {
        (
            u.user_id,
            state.data.global_users.is_diamond_member(&u.user_id, state.env.now()),
        )
    })
}

fn build_token(user_id: UserId, args: Args, state: &mut RuntimeState) -> Response {
    let Some(secret_key_der) = state.data.oc_secret_key_der.as_ref() else {
        return InternalError("OC Secret not set".to_string());
    };

    let claims = Claims::new(
        state.env.now() + 300_000, // Token valid for 5 mins from now
        args.token_type.to_string(),
        VideoCallClaims {
            user_id,
            chat_id: args.chat.into(),
        },
    );

    // Salt the RNG with the input args
    let salt = serde_json::to_string(&args).unwrap().into_bytes();

    let mut rng = StdRng::from_seed(state.env.entropy(Some(&salt)));

    match jwt::sign_and_encode_token(secret_key_der, claims, &mut rng) {
        Ok(token) => Success(token),
        Err(err) => InternalError(format!("{err:?}")),
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
        Ok(true) => Ok(()),
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
        Ok(true) => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

async fn check_user_access(
    chat_id: ChatId,
    user_id: UserId,
    is_diamond: bool,
    access_type: AccessTokenType,
) -> Result<(), Response> {
    match user_canister_c2c_client::c2c_can_issue_access_token(
        chat_id.into(),
        &user_canister::c2c_can_issue_access_token::Args {
            user_id,
            is_diamond,
            access_type,
        },
    )
    .await
    {
        Ok(true) => Ok(()),
        Ok(_) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

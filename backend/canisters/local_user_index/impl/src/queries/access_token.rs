use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use jwt::Claims;
use local_user_index_canister::access_token::{Response::*, *};
use rand::rngs::StdRng;
use rand::SeedableRng;
use serde::Serialize;
use types::{
    AccessTokenType, BotCommandClaims, ChannelId, Chat, ChatId, CommunityId, JoinOrEndVideoCallClaims, StartVideoCallClaims,
    UserId,
};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
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

    mutate_state(|state| match &args.token_type {
        AccessTokenType::StartVideoCallV2(vc) => {
            let custom_claims = StartVideoCallClaims {
                user_id,
                chat_id: args.chat.into(),
                call_type: vc.call_type,
                is_diamond,
            };
            build_token(args.token_type, custom_claims, state)
        }
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => {
            let custom_claims = JoinOrEndVideoCallClaims {
                user_id,
                chat_id: args.chat.into(),
            };
            build_token(args.token_type, custom_claims, state)
        }
        AccessTokenType::BotCommand(bc) => {
            let bot_api_gateway = state.data.internet_identity_canister_id;
            let custom_claims = BotCommandClaims {
                user_id: bc.user_id,
                bot: bc.bot,
                thread_root_message_index: bc.thread_root_message_index,
                message_id: bc.message_id,
                bot_api_gateway,
                reply_url: format!("https://{bot_api_gateway}.icp0.io/call"),
            };
            build_token(args.token_type, custom_claims, state)
        }
    })
}

fn get_user(state: &RuntimeState) -> Option<(UserId, bool)> {
    state
        .data
        .global_users
        .get_by_principal(&state.env.caller())
        .filter(|u| !u.user_type.is_bot())
        .map(|u| {
            (
                u.user_id,
                state.data.global_users.is_diamond_member(&u.user_id, state.env.now()),
            )
        })
}

fn build_token<T: Serialize>(token_type: AccessTokenType, custom_claims: T, state: &mut RuntimeState) -> Response {
    if !state.data.oc_key_pair.is_initialised() {
        return InternalError("OC Secret not set".to_string());
    };

    let mut rng = StdRng::from_seed(state.env.entropy());

    let claims = Claims::new(
        state.env.now() + 300_000, // Token valid for 5 mins from now
        token_type.type_name().to_string(),
        custom_claims,
    );

    match jwt::sign_and_encode_token(state.data.oc_key_pair.secret_key_der(), claims, &mut rng) {
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

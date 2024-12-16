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
    AccessTokenType, BotCommandClaims, ChannelId, Chat, ChatId, CheckAccessTokenType, CheckBotCommandArgs, CommunityId,
    JoinOrEndVideoCallClaims, StartVideoCallClaims, UserId,
};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
#[trace]
async fn access_token(args: Args) -> Response {
    let PrepareResult {
        user_id,
        is_diamond,
        check_access_type,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(r) => r,
        Err(response) => return response,
    };

    match args.chat {
        Chat::Direct(chat_id) => {
            if let Err(response) = check_user_access(chat_id, user_id, is_diamond, check_access_type).await {
                return response;
            }
        }
        Chat::Group(chat_id) => {
            if let Err(response) = check_group_access(chat_id, user_id, is_diamond, check_access_type).await {
                return response;
            }
        }
        Chat::Channel(community_id, channel_id) => {
            if let Err(response) = check_channel_access(community_id, channel_id, user_id, is_diamond, check_access_type).await
            {
                return response;
            }
        }
    }

    let token_type_name = args.token_type.type_name().to_string();

    mutate_state(|state| match args.token_type {
        AccessTokenType::StartVideoCallV2(vc) => {
            let custom_claims = StartVideoCallClaims {
                user_id,
                chat_id: args.chat.into(),
                call_type: vc.call_type,
                is_diamond,
            };
            build_token(token_type_name, custom_claims, state)
        }
        AccessTokenType::JoinVideoCall | AccessTokenType::MarkVideoCallAsEnded => {
            let custom_claims = JoinOrEndVideoCallClaims {
                user_id,
                chat_id: args.chat.into(),
            };
            build_token(token_type_name, custom_claims, state)
        }
        AccessTokenType::BotCommand(bc) => {
            let custom_claims = BotCommandClaims {
                initiator: bc.user_id,
                bot: bc.bot,
                chat: bc.chat,
                thread_root_message_index: bc.thread_root_message_index,
                message_id: bc.message_id,
                command_name: bc.command_name,
                parameters: bc.parameters,
                version: bc.version,
                command_text: bc.command_text,
                bot_api_gateway: state.env.canister_id(),
            };
            build_token(token_type_name, custom_claims, state)
        }
    })
}

struct PrepareResult {
    user_id: UserId,
    is_diamond: bool,
    check_access_type: CheckAccessTokenType,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let Some(user) = state
        .data
        .global_users
        .get_by_principal(&state.env.caller())
        .filter(|u| !u.user_type.is_bot())
    else {
        return Err(Response::NotAuthorized);
    };

    let user_id = user.user_id;
    let is_diamond = state.data.global_users.is_diamond_member(&user_id, state.env.now());
    let token_type = args.token_type.clone();

    let check_access_type = match token_type {
        AccessTokenType::StartVideoCallV2(video_call_access_token_args) => {
            CheckAccessTokenType::StartVideoCallV2(video_call_access_token_args)
        }
        AccessTokenType::JoinVideoCall => CheckAccessTokenType::JoinVideoCall,
        AccessTokenType::MarkVideoCallAsEnded => CheckAccessTokenType::MarkVideoCallAsEnded,
        AccessTokenType::BotCommand(cmd) => {
            let Some(permissions) = state
                .data
                .bots
                .get(&cmd.bot)
                .and_then(|b| b.commands.iter().find(|c| c.name == cmd.command_name))
                .map(|c| c.permissions.clone())
            else {
                return Err(Response::NotAuthorized);
            };

            CheckAccessTokenType::BotCommand(CheckBotCommandArgs {
                user_id: cmd.user_id,
                bot: cmd.bot,
                chat: cmd.chat,
                thread_root_message_index: cmd.thread_root_message_index,
                message_id: cmd.message_id,
                permissions,
            })
        }
    };

    Ok(PrepareResult {
        user_id,
        is_diamond,
        check_access_type,
    })
}

fn build_token<T: Serialize>(token_type_name: String, custom_claims: T, state: &mut RuntimeState) -> Response {
    if !state.data.oc_key_pair.is_initialised() {
        return InternalError("OC Secret not set".to_string());
    };

    let mut rng = StdRng::from_seed(state.env.entropy());

    let claims = Claims::new(
        state.env.now() + 300_000, // Token valid for 5 mins from now
        token_type_name,
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
    access_type: CheckAccessTokenType,
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
    access_type: CheckAccessTokenType,
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
    access_type: CheckAccessTokenType,
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

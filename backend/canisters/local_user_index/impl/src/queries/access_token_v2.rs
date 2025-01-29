use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use community_canister::c2c_can_issue_access_token;
use jwt::Claims;
use local_user_index_canister::access_token_v2::{Response::*, *};
use rand::rngs::StdRng;
use rand::SeedableRng;
use serde::Serialize;
use types::c2c_can_issue_access_token::{
    AccessTypeArgs, BotActionByApiKeyArgs, BotActionByCommandArgs, JoinVideoCallArgs, MarkVideoCallAsEndedArgs,
    StartVideoCallArgs,
};
use types::{
    AccessTokenScope, BotActionByApiKeyClaims, BotActionByCommandClaims, Chat, JoinOrEndVideoCallClaims, StartVideoCallClaims,
};

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
#[trace]
async fn access_token_v2(args_outer: Args) -> Response {
    let PrepareResult { scope, access_type_args } = match read_state(|state| prepare(&args_outer, state)) {
        Ok(r) => r,
        Err(response) => return response,
    };

    let c2c_response = match scope {
        AccessTokenScope::Chat(Chat::Direct(chat_id)) => {
            user_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), &access_type_args).await
        }
        AccessTokenScope::Chat(Chat::Group(chat_id)) => {
            group_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), &access_type_args).await
        }
        AccessTokenScope::Chat(Chat::Channel(community_id, channel_id)) => {
            community_canister_c2c_client::c2c_can_issue_access_token(
                community_id.into(),
                &community_canister::c2c_can_issue_access_token::Args {
                    channel_id: Some(channel_id),
                    access_type: access_type_args.clone(),
                },
            )
            .await
        }
        AccessTokenScope::Community(community_id) => {
            community_canister_c2c_client::c2c_can_issue_access_token(
                community_id.into(),
                &community_canister::c2c_can_issue_access_token::Args {
                    channel_id: None,
                    access_type: access_type_args.clone(),
                },
            )
            .await
        }
    };

    let granted_permissions = match c2c_response {
        Ok(c2c_can_issue_access_token::Response::Success) => None,
        Ok(c2c_can_issue_access_token::Response::SuccessBot(permissions)) => Some(permissions),
        Ok(c2c_can_issue_access_token::Response::Failure) => return NotAuthorized,
        Err(err) => return InternalError(format!("{err:?}")),
    };

    let token_type_name = args_outer.type_name().to_string();

    mutate_state(|state| {
        let chat = match &args_outer {
            Args::BotActionByCommand(args) => {
                let custom_claims = BotActionByCommandClaims {
                    bot: args.bot_id,
                    scope: args.scope.clone(),
                    bot_api_gateway: state.env.canister_id(),
                    granted_permissions: granted_permissions.unwrap(),
                    command: args.command.clone(),
                };
                return build_token(token_type_name, custom_claims, state);
            }
            Args::BotActionByApiKey(args) => {
                let custom_claims = BotActionByApiKeyClaims {
                    bot: args.bot_id,
                    scope: args.scope.clone(),
                    bot_api_gateway: state.env.canister_id(),
                    granted_permissions: granted_permissions.unwrap(),
                };
                return build_token(token_type_name, custom_claims, state);
            }
            Args::StartVideoCall(args) => args.chat,
            Args::JoinVideoCall(args) => args.chat,
            Args::MarkVideoCallAsEnded(args) => args.chat,
        };

        match access_type_args {
            AccessTypeArgs::StartVideoCall(args) => {
                let custom_claims = StartVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat,
                    call_type: args.call_type,
                    is_diamond: args.is_diamond,
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::JoinVideoCall(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat,
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::MarkVideoCallAsEnded(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat,
                };
                build_token(token_type_name, custom_claims, state)
            }
            _ => unreachable!(),
        }
    })
}

struct PrepareResult {
    scope: AccessTokenScope,
    access_type_args: AccessTypeArgs,
}

fn prepare(args_outer: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Args::BotActionByApiKey(args) = args_outer {
        let Some(permissions) = state
            .data
            .bots
            .get(&args.bot_id)
            .and_then(|b| b.autonomous_config.as_ref())
            .map(|c| c.permissions.clone())
        else {
            return Err(Response::NotAuthorized);
        };

        return Ok(PrepareResult {
            scope: args.scope.clone(),
            access_type_args: AccessTypeArgs::BotActionByApiKey(BotActionByApiKeyArgs {
                bot_id: args.bot_id,
                secret: args.secret.clone(),
                requested_permissions: permissions,
            }),
        });
    }

    if let Args::BotActionByCommand(args) = args_outer {
        let Some(permissions) = state
            .data
            .bots
            .get(&args.bot_id)
            .and_then(|b| b.commands.iter().find(|c| c.name == args.command.name))
            .map(|c| c.permissions.clone())
        else {
            return Err(Response::NotAuthorized);
        };

        let scope = args.scope.clone().into();

        return Ok(PrepareResult {
            scope,
            access_type_args: AccessTypeArgs::BotActionByCommand(BotActionByCommandArgs {
                bot_id: args.bot_id,
                initiator: args.command.initiator,
                requested_permissions: permissions,
            }),
        });
    }

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

    let result = match args_outer {
        Args::StartVideoCall(args) => PrepareResult {
            scope: AccessTokenScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::StartVideoCall(StartVideoCallArgs {
                initiator: user_id,
                call_type: args.call_type,
                is_diamond,
            }),
        },
        Args::JoinVideoCall(args) => PrepareResult {
            scope: AccessTokenScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::JoinVideoCall(JoinVideoCallArgs {
                initiator: user_id,
                is_diamond,
            }),
        },
        Args::MarkVideoCallAsEnded(args) => PrepareResult {
            scope: AccessTokenScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs { initiator: user_id }),
        },
        _ => unreachable!(),
    };

    Ok(result)
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

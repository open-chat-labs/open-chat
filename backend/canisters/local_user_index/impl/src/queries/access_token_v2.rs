use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use community_canister::c2c_can_issue_access_token;
use jwt::Claims;
use local_user_index_canister::access_token_v2::{self, Response::*, *};
use rand::rngs::StdRng;
use rand::SeedableRng;
use serde::Serialize;
use types::c2c_can_issue_access_token::{
    AccessTypeArgs, BotActionByApiKeyArgs, BotActionByCommandArgs, JoinVideoCallArgs, MarkVideoCallAsEndedArgs,
    StartVideoCallArgs,
};
use types::{
    c2c_bot_api_key, AccessTokenScope, BotActionByApiKeyClaims, BotActionByCommandClaims, BotApiKeyToken, BotCommand,
    BotCommandArg, BotCommandArgValue, BotPermissions, Chat, GroupRole, JoinOrEndVideoCallClaims, StartVideoCallClaims,
};
use utils::base64;

const SYNC_API_KEY_COMMAND_NAME: &str = "sync_api_key";

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn access_token_v2(args_wrapper: Args) -> Response {
    let Ok(args_wrapper) = ArgsInternal::from(args_wrapper) else {
        return InternalError("Failed to parse arguments".to_string());
    };

    let PrepareResult { scope, access_type_args } = match read_state(|state| prepare(&args_wrapper, state)) {
        Ok(r) => r,
        Err(response) => return response,
    };

    // If this is a special sync_api_key command, we need to fetch the API key
    let mut api_key_args = None;
    if let ArgsInternal::BotActionByCommand(a) = &args_wrapper {
        if a.command.name.eq_ignore_ascii_case(SYNC_API_KEY_COMMAND_NAME) {
            api_key_args = Some(c2c_bot_api_key::Args {
                bot_id: a.bot_id,
                initiator: access_type_args.initiator().unwrap(),
            })
        }
    };

    // Either fetch the API key or check if the user can issue an access token for the given scope
    let api_key = if let Some(api_key_args) = api_key_args {
        match get_api_key(scope, api_key_args).await {
            Ok(api_key) => Some(api_key),
            Err(response) => return response,
        }
    } else {
        match can_issue_access_token(scope, &access_type_args).await {
            Ok(_) => None,
            Err(response) => return response,
        }
    };

    let token_type_name = args_wrapper.type_name().to_string();

    mutate_state(|state| {
        let chat = args_wrapper.chat();

        match &args_wrapper {
            ArgsInternal::BotActionByCommand(args) => {
                let command_args = if let Some(api_key) = api_key {
                    vec![BotCommandArg {
                        name: "api_key".to_string(),
                        value: BotCommandArgValue::String(api_key),
                    }]
                } else {
                    args.command.args.clone()
                };

                let custom_claims = BotActionByCommandClaims {
                    bot: args.bot_id,
                    scope: args.scope.clone(),
                    bot_api_gateway: state.env.canister_id(),
                    granted_permissions: access_type_args.requested_permissions().unwrap().into(),
                    command: BotCommand {
                        name: args.command.name.clone(),
                        args: command_args,
                        initiator: access_type_args.initiator().unwrap(),
                    },
                };
                return build_token(token_type_name, custom_claims, state);
            }
            ArgsInternal::BotActionByApiKey(args) => {
                let custom_claims = BotActionByApiKeyClaims {
                    bot: args.bot_id,
                    scope: args.scope.clone(),
                    bot_api_gateway: state.env.canister_id(),
                    granted_permissions: access_type_args.requested_permissions().unwrap().into(),
                };
                return build_token(token_type_name, custom_claims, state);
            }
            _ => (),
        }

        match access_type_args {
            AccessTypeArgs::StartVideoCall(args) => {
                let custom_claims = StartVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
                    call_type: args.call_type,
                    is_diamond: args.is_diamond,
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::JoinVideoCall(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::MarkVideoCallAsEnded(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
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

fn prepare(args_outer: &ArgsInternal, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let ArgsInternal::BotActionByApiKey(args) = args_outer {
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

    let Some(user) = state
        .data
        .global_users
        .get_by_principal(&state.env.caller())
        .filter(|u| !u.user_type.is_bot())
    else {
        return Err(Response::NotAuthorized);
    };

    if let ArgsInternal::BotActionByCommand(args) = args_outer {
        let bot = state.data.bots.get(&args.bot_id).ok_or(Response::NotAuthorized)?;

        let (permissions, default_role) = if args.command.name.eq_ignore_ascii_case(SYNC_API_KEY_COMMAND_NAME) {
            if bot.autonomous_config.as_ref().is_none_or(|config| !config.sync_api_key) {
                return Err(Response::NotAuthorized);
            }
            (BotPermissions::default(), GroupRole::Owner)
        } else {
            let command = bot
                .commands
                .iter()
                .find(|c| c.name == args.command.name)
                .ok_or(Response::NotAuthorized)?;

            (command.permissions.clone(), command.default_role.unwrap_or_default())
        };

        return Ok(PrepareResult {
            scope: args.scope.clone().into(),
            access_type_args: AccessTypeArgs::BotActionByCommand(BotActionByCommandArgs {
                bot_id: args.bot_id,
                initiator: user.user_id,
                initiator_role: default_role,
                requested_permissions: permissions,
            }),
        });
    }

    let user_id = user.user_id;
    let is_diamond = state.data.global_users.is_diamond_member(&user_id, state.env.now());

    let result = match args_outer {
        ArgsInternal::StartVideoCall(args) => PrepareResult {
            scope: AccessTokenScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::StartVideoCall(StartVideoCallArgs {
                initiator: user_id,
                call_type: args.call_type,
                is_diamond,
            }),
        },
        ArgsInternal::JoinVideoCall(args) => PrepareResult {
            scope: AccessTokenScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::JoinVideoCall(JoinVideoCallArgs {
                initiator: user_id,
                is_diamond,
            }),
        },
        ArgsInternal::MarkVideoCallAsEnded(args) => PrepareResult {
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

#[allow(clippy::large_enum_variant)]
#[derive(Debug)]
enum ArgsInternal {
    StartVideoCall(access_token_v2::StartVideoCallArgs),
    JoinVideoCall(access_token_v2::JoinVideoCallArgs),
    MarkVideoCallAsEnded(access_token_v2::MarkVideoCallAsEndedArgs),
    BotActionByCommand(access_token_v2::BotActionByCommandArgs),
    BotActionByApiKey(BotApiKeyToken),
}

impl ArgsInternal {
    pub fn from(value: Args) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        match value {
            Args::StartVideoCall(args) => Ok(ArgsInternal::StartVideoCall(args)),
            Args::JoinVideoCall(args) => Ok(ArgsInternal::JoinVideoCall(args)),
            Args::MarkVideoCallAsEnded(args) => Ok(ArgsInternal::MarkVideoCallAsEnded(args)),
            Args::BotActionByCommand(args) => Ok(ArgsInternal::BotActionByCommand(args)),
            Args::BotActionByApiKey(args) => {
                let token: BotApiKeyToken = base64::to_value(&args)?;
                Ok(ArgsInternal::BotActionByApiKey(token))
            }
        }
    }

    pub fn type_name(&self) -> &str {
        match self {
            Self::StartVideoCall(_) => "StartVideoCall",
            Self::JoinVideoCall(_) => "JoinVideoCall",
            Self::MarkVideoCallAsEnded(_) => "MarkVideoCallAsEnded",
            Self::BotActionByCommand(_) => "BotActionByCommand",
            Self::BotActionByApiKey(_) => "BotActionByApiKey",
        }
    }

    pub fn chat(&self) -> Option<Chat> {
        match self {
            Self::StartVideoCall(args) => Some(args.chat),
            Self::JoinVideoCall(args) => Some(args.chat),
            Self::MarkVideoCallAsEnded(args) => Some(args.chat),
            Self::BotActionByCommand(args) => args.scope.chat(),
            Self::BotActionByApiKey(args) => args.scope.chat(),
        }
    }
}

async fn get_api_key(scope: AccessTokenScope, api_key_args: c2c_bot_api_key::Args) -> Result<String, Response> {
    let response = match scope {
        AccessTokenScope::Chat(Chat::Group(chat_id)) => {
            group_canister_c2c_client::c2c_bot_api_key(chat_id.into(), &api_key_args).await
        }
        AccessTokenScope::Chat(Chat::Channel(community_id, channel_id)) => {
            community_canister_c2c_client::c2c_bot_api_key(
                community_id.into(),
                &community_canister::c2c_bot_api_key::Args {
                    bot_id: api_key_args.bot_id,
                    initiator: api_key_args.initiator,
                    channel_id: Some(channel_id),
                },
            )
            .await
        }
        AccessTokenScope::Chat(Chat::Direct(_)) => unimplemented!("TODO when the canister memory limit has been raised"),
        AccessTokenScope::Community(community_id) => {
            community_canister_c2c_client::c2c_bot_api_key(
                community_id.into(),
                &community_canister::c2c_bot_api_key::Args {
                    bot_id: api_key_args.bot_id,
                    initiator: api_key_args.initiator,
                    channel_id: None,
                },
            )
            .await
        }
    };

    match response {
        Ok(c2c_bot_api_key::Response::Success(api_key)) => Ok(api_key),
        Ok(_) => Err(NotAuthorized),
        Err((code, message)) => Err(InternalError(format!("{code:?}: {message}"))),
    }
}

async fn can_issue_access_token(scope: AccessTokenScope, access_type_args: &AccessTypeArgs) -> Result<(), Response> {
    let c2c_response = match scope {
        AccessTokenScope::Chat(Chat::Direct(chat_id)) => {
            user_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), access_type_args).await
        }
        AccessTokenScope::Chat(Chat::Group(chat_id)) => {
            group_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), access_type_args).await
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

    match c2c_response {
        Ok(c2c_can_issue_access_token::Response::Success) => Ok(()),
        Ok(c2c_can_issue_access_token::Response::Failure) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}

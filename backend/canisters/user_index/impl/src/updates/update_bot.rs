use crate::{
    model::{user_map::UpdateUserResult, MAX_AVATAR_SIZE, MAX_COMMANDS, MAX_DESCRIPTION_LEN},
    mutate_state, read_state, RuntimeState,
};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::http_request::{CanisterHttpRequestArgument, HttpMethod};
use tracing::error;
use types::{BotDefinition, OptionUpdate};
use url::Url;
use user_index_canister::update_bot::{Response::*, *};
use utils::{document::try_parse_data_url, text_validation::validate_username};

#[update(msgpack = true)]
#[trace]
async fn update_bot(args: Args) -> Response {
    let result = match read_state(|state| prepare(&args, state)) {
        Ok(result) => result,
        Err(response) => return response,
    };

    let endpoint = args.endpoint.as_ref().unwrap_or(&result.bot_endpoint);

    let bot_definition = match get_valid_bot_definition(endpoint.to_string()).await {
        Ok(r) => r,
        Err(response) => return response,
    };

    if let Err(response) = mutate_state(|state| commit(args, bot_definition, state)) {
        return response;
    }

    // TODO: If there are any new commands or the required permissions have increased for any existing commands,
    // then notify all the group/communities that have added this bot

    Success
}

struct PrepareResult {
    pub bot_endpoint: String,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if let Some(name) = args.name.as_ref() {
        if validate_username(name).is_err() {
            return Err(NameInvalid);
        }

        if state.data.users.does_username_exist(name, true) {
            return Err(NameAlreadyExists);
        }
    }

    if let OptionUpdate::SetToSome(avatar) = args.avatar.as_ref() {
        if avatar.len() > MAX_AVATAR_SIZE {
            return Err(AvatarInvalid);
        }

        if try_parse_data_url(avatar).is_none() {
            return Err(AvatarInvalid);
        }
    }

    if let Some(endpoint) = args.endpoint.as_ref() {
        if Principal::from_text(endpoint).is_err() && Url::parse(endpoint).is_err() {
            return Err(EndpointInvalid);
        }
    }

    if let Some(new_owner) = args.owner.as_ref() {
        let Some(owner) = state.data.users.get_by_user_id(new_owner) else {
            return Err(NewOwnerNotFound);
        };

        if owner.suspension_details.is_some() {
            return Err(NewOwnerSuspended);
        }
    }

    let Some(bot) = state.data.users.get_bot(&args.bot_id) else {
        return Err(BotNotFound);
    };

    let Some(bot_user) = state.data.users.get_by_user_id(&args.bot_id) else {
        return Err(BotNotFound);
    };

    if bot_user.suspension_details.is_some() {
        return Err(BotSuspended);
    }

    let caller = state.env.caller();

    let Some(owner) = state.data.users.get_by_principal(&caller) else {
        return Err(OwnerNotFound);
    };

    if owner.user_id != bot_user.user_id {
        return Err(NotAuthorised);
    }

    if owner.suspension_details.is_some() {
        return Err(OwnerSuspended);
    }

    // TODO: Throttle how often this endpoint can be called because of relatively high cost
    // to make an HTTP out call

    Ok(PrepareResult {
        bot_endpoint: bot.endpoint.clone(),
    })
}

async fn get_valid_bot_definition(url: String) -> Result<BotDefinition, Response> {
    let (response,) = ic_cdk::api::management_canister::http_request::http_request_with_closure(
        CanisterHttpRequestArgument {
            url,
            max_response_bytes: Some(1024 * 1024), // 1 MB
            method: HttpMethod::GET,
            headers: vec![],
            body: None,
            transform: None,
        },
        100_000_000_000,
        |mut response| {
            response.headers.clear();
            response
        },
    )
    .await
    .map_err(|error| {
        error!(?error, "Error getting bot definition");
        DefinitionNotFound
    })?;

    let bot_definition: BotDefinition = serde_json::from_slice(&response.body).map_err(|error| {
        error!(?error, "Bot definition invalid");
        DefinitionInvalid
    })?;

    if bot_definition.description.len() > MAX_DESCRIPTION_LEN {
        return Err(DescriptionTooLong);
    }

    if bot_definition.commands.len() > MAX_COMMANDS {
        return Err(TooManyCommands);
    }

    Ok(bot_definition)
}

fn commit(args: Args, bot_definition: BotDefinition, state: &mut RuntimeState) -> Result<(), Response> {
    let Some(bot) = state.data.users.get_bot(&args.bot_id) else {
        return Err(BotNotFound);
    };

    let Some(user) = state.data.users.get_by_user_id(&args.bot_id) else {
        return Err(BotNotFound);
    };

    let mut bot = bot.clone();
    let mut user = user.clone();

    if let Some(name) = args.name {
        bot.name = name.clone();
        user.username = name.clone();
    }

    if let Some(owner_id) = args.owner {
        bot.owner = owner_id;
    }

    if let Some(endpoint) = args.endpoint {
        bot.endpoint = endpoint.clone();
    }

    match args.avatar {
        OptionUpdate::NoChange => (),
        OptionUpdate::SetToNone => {
            bot.avatar = None;
            user.avatar_id = None;
        }
        OptionUpdate::SetToSome(avatar) => {
            bot.avatar = try_parse_data_url(&avatar);
            user.avatar_id = bot.avatar.as_ref().map(|a| a.id);
        }
    };

    let now = state.env.now();

    bot.description = bot_definition.description;
    bot.commands = bot_definition.commands;
    bot.last_updated = now;

    match state.data.users.update(user, now, true, Some(bot)) {
        UpdateUserResult::Success => Ok(()),
        UpdateUserResult::UsernameTaken => Err(NameAlreadyExists),
        UpdateUserResult::UserNotFound => Err(BotNotFound),
        UpdateUserResult::PrincipalTaken => unreachable!(),
    }
}

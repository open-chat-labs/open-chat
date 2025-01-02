use crate::{
    model::{user_map::UpdateUserResult, MAX_AVATAR_SIZE, MAX_COMMANDS, MAX_DESCRIPTION_LEN},
    mutate_state, RuntimeState,
};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{BotUpdated, UserIndexEvent};
use types::OptionUpdate;
use url::Url;
use user_index_canister::update_bot::{Response::*, *};
use utils::{document::try_parse_data_url, text_validation::validate_username};

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    mutate_state(|state| update_bot_impl(args, state))
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Err(err_response) = validate(&args, state) {
        return err_response;
    }

    let Some(bot) = state.data.users.get_bot(&args.bot_id) else {
        return BotNotFound;
    };

    let Some(user) = state.data.users.get_by_user_id(&args.bot_id) else {
        return BotNotFound;
    };

    let mut bot = bot.clone();
    let mut user = user.clone();

    if let Some(name) = args.name.as_ref() {
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

    if let Some(definition) = args.definition.as_ref() {
        bot.description = definition.description.clone();
        bot.commands = definition.commands.clone();
    }

    let now = state.env.now();

    bot.last_updated = now;

    match state.data.users.update(user, now, true, Some(bot)) {
        UpdateUserResult::Success => (),
        UpdateUserResult::UsernameTaken => return NameAlreadyExists,
        UpdateUserResult::UserNotFound => return BotNotFound,
        UpdateUserResult::PrincipalTaken => unreachable!(),
    }

    state.push_event_to_all_local_user_indexes(
        UserIndexEvent::BotUpdated(BotUpdated {
            user_id: args.bot_id,
            name: args.name.clone(),
            commands: args.definition.map(|d| d.commands.clone()),
        }),
        None,
    );

    // TODO: If there are any new commands or the required permissions have increased for any existing commands,
    // then notify all the group/communities that have added this bot
    Success
}

fn validate(args: &Args, state: &RuntimeState) -> Result<(), Response> {
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

    if owner.user_id != bot.owner {
        return Err(NotAuthorised);
    }

    if owner.suspension_details.is_some() {
        return Err(OwnerSuspended);
    }

    if let Some(definition) = args.definition.as_ref() {
        if definition.description.len() > MAX_DESCRIPTION_LEN {
            return Err(DescriptionTooLong);
        }

        if definition.commands.len() > MAX_COMMANDS {
            return Err(TooManyCommands);
        }
    }

    // TODO: Throttle how often this endpoint can be called because of relatively high cost
    // to make an HTTP out call
    Ok(())
}

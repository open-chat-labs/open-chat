use crate::{
    RuntimeState,
    model::{MAX_AVATAR_SIZE, MAX_COMMANDS, MAX_DESCRIPTION_LEN, user_map::UpdateBotResult},
    mutate_state,
};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{BotUpdated, UserIndexEvent};
use types::{BotInstallationUpdate, OptionUpdate};
use url::Url;
use user_index_canister::update_bot::{Response::*, *};
use utils::document::try_parse_data_url;

#[update(candid = true, msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    mutate_state(|state| update_bot_impl(args, state))
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Err(err_response) = validate(&args, state) {
        return err_response;
    }

    let avatar = match args.avatar {
        OptionUpdate::NoChange => OptionUpdate::NoChange,
        OptionUpdate::SetToNone => OptionUpdate::SetToNone,
        OptionUpdate::SetToSome(id) => {
            if let Ok(doc) = try_parse_data_url(&id) {
                OptionUpdate::SetToSome(doc)
            } else {
                return AvatarInvalid;
            }
        }
    };

    let mut installation_update = BotInstallationUpdate {
        bot_id: args.bot_id,
        command_permissions: OptionUpdate::NoChange,
        autonomous_permissions: OptionUpdate::NoChange,
        default_subscriptions: OptionUpdate::NoChange,
    };

    if let Some(definition) = args.definition.clone() {
        let Some(bot) = state.data.users.get_bot(&args.bot_id) else {
            return BotNotFound;
        };

        installation_update.command_permissions =
            OptionUpdate::from(&bot.definition.command_permissions(), definition.command_permissions());

        installation_update.autonomous_permissions = OptionUpdate::from(
            &bot.definition.autonomous_config.as_ref().map(|c| c.permissions.clone()),
            definition.autonomous_config.as_ref().map(|c| c.permissions.clone()),
        );

        installation_update.default_subscriptions = OptionUpdate::from(
            &bot.definition.default_subscriptions,
            definition.default_subscriptions.clone(),
        );
    }

    match state.data.users.update_bot(
        args.bot_id,
        args.owner,
        args.principal,
        avatar,
        args.endpoint,
        args.definition.clone(),
        state.env.now(),
    ) {
        UpdateBotResult::Success => (),
        UpdateBotResult::UserNotFound => return BotNotFound,
        UpdateBotResult::PrincipalTaken => return PrincipalAlreadyUsed,
    };

    if let Some(definition) = args.definition {
        let bot = state.data.users.get_bot(&args.bot_id).unwrap();

        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::BotUpdated(BotUpdated {
                bot_id: args.bot_id,
                owner_id: bot.owner,
                endpoint: bot.endpoint.clone(),
                definition,
            }),
            None,
        );

        if installation_update.has_updates() {
            let bot = state.data.users.get_bot(&args.bot_id).unwrap();

            for (location, details) in bot.installations.iter() {
                state.data.user_index_event_sync_queue.push(
                    details.local_user_index,
                    UserIndexEvent::BotUpdateInstallation(*location, installation_update.clone()),
                );
            }
        }
    }

    Success
}

fn validate(args: &Args, state: &RuntimeState) -> Result<(), Response> {
    if let Some(principal) = args.principal
        && principal == Principal::anonymous()
    {
        return Err(PrincipalInvalid);
    }

    if let OptionUpdate::SetToSome(avatar) = args.avatar.as_ref() {
        if avatar.len() > MAX_AVATAR_SIZE {
            return Err(AvatarInvalid);
        }

        if try_parse_data_url(avatar).is_err() {
            return Err(AvatarInvalid);
        }
    }

    if let Some(endpoint) = args.endpoint.as_ref()
        && Principal::from_text(endpoint).is_err()
        && Url::parse(endpoint).is_err()
    {
        return Err(EndpointInvalid);
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

    Ok(())
}

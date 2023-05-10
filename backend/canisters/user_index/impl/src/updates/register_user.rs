use crate::{mutate_state, RuntimeState, ONE_MB, USER_LIMIT};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, OpenChatBotMessage, UserRegistered, UsernameChanged};
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, MessageContent, TextContent, UserId};
use user_index_canister::register_user_v2::{Response::*, *};
use utils::username_validation::{validate_username, UsernameValidationError};
use x509_parser::prelude::FromDer;
use x509_parser::x509::SubjectPublicKeyInfo;

#[update]
#[trace]
async fn register_user(args: user_index_canister::register_user::Args) -> Response {
    register_user_v2(Args {
        username: args.username,
        referral_code: args.referred_by.map(|referred_by| referred_by.to_string()),
        public_key: args.public_key,
    })
    .await
}

#[update]
#[trace]
async fn register_user_v2(args: Args) -> Response {
    // Check the principal is derived from Internet Identity
    // Check the username is valid and doesn't already exist then reserve it
    let PrepareOk {
        local_user_index_canister,
        caller,
        referred_by,
        openchat_bot_messages,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_create_user_args = local_user_index_canister::c2c_create_user::Args {
        principal: caller,
        username: args.username.clone(),
        referred_by,
        openchat_bot_messages,
    };

    match local_user_index_canister_c2c_client::c2c_create_user(local_user_index_canister, &c2c_create_user_args).await {
        Ok(local_user_index_canister::c2c_create_user::Response::Success(user_id)) => {
            mutate_state(|state| {
                commit_registered_user(caller, args.username, user_id, referred_by, local_user_index_canister, state)
            });
            Success(user_id)
        }
        Ok(local_user_index_canister::c2c_create_user::Response::AlreadyRegistered) => AlreadyRegistered,
        Ok(local_user_index_canister::c2c_create_user::Response::CyclesBalanceTooLow) => CyclesBalanceTooLow,
        Ok(local_user_index_canister::c2c_create_user::Response::InternalError(error)) => InternalError(error),
        Err(error) => InternalError(format!("{error:?}")),
    }
}

struct PrepareOk {
    caller: Principal,
    local_user_index_canister: CanisterId,
    referred_by: Option<UserId>,
    openchat_bot_messages: Vec<MessageContent>,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let mut referred_by = None;

    if let Err(error) = validate_public_key(caller, &args.public_key, runtime_state.data.internet_identity_canister_id) {
        return Err(PublicKeyInvalid(error));
    }

    if runtime_state.data.users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if runtime_state.data.users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    if let Some(code) = &args.referral_code {
        referred_by = Principal::from_text(code).ok().map(UserId::from);
    }

    match validate_username(&args.username) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(min_length)) => return Err(UsernameTooShort(min_length)),
        Err(UsernameValidationError::TooLong(max_length)) => return Err(UsernameTooLong(max_length)),
        Err(UsernameValidationError::Invalid) => return Err(UsernameInvalid),
    };

    if let Some(local_user_index_canister) = runtime_state.data.local_index_map.index_for_new_user() {
        let openchat_bot_messages = welcome_messages()
            .into_iter()
            .map(|t| MessageContent::Text(TextContent { text: t }))
            .collect();

        Ok(PrepareOk {
            local_user_index_canister,
            caller,
            referred_by,
            openchat_bot_messages,
        })
    } else {
        Err(InternalError("All subnets are full".to_string()))
    }
}

pub(crate) fn commit_registered_user(
    caller: Principal,
    username: String,
    user_id: UserId,
    referred_by: Option<UserId>,
    local_user_index_canister_id: CanisterId,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();

    let mut original_username = None;
    let username = match runtime_state.data.users.ensure_unique_username(&username) {
        Ok(_) => username,
        Err(new_username) => {
            original_username = Some(username);
            new_username
        }
    };

    runtime_state
        .data
        .users
        .register(caller, user_id, username.clone(), now, referred_by, false);

    runtime_state
        .data
        .local_index_map
        .add_user(local_user_index_canister_id, user_id);

    runtime_state.push_event_to_all_local_user_indexes(
        Event::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username: username.clone(),
            is_bot: false,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );
    if let Some(original_username) = original_username {
        runtime_state.push_event_to_local_user_index(
            user_id,
            Event::UsernameChanged(UsernameChanged {
                user_id,
                username: username.clone(),
            }),
        );
        runtime_state.push_event_to_local_user_index(
            user_id,
            Event::OpenChatBotMessage(OpenChatBotMessage {
                user_id,
                message: MessageContent::Text(TextContent {
                    text: format!("Unfortunately the username \"{original_username}\" was taken so your username has been changed to \"{username}\".

You can change your username at any time by clicking \"Profile settings\" from the main menu.")
                }),
            }),
        );
    }

    runtime_state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: caller,
        byte_limit: 100 * ONE_MB,
    });

    crate::jobs::sync_users_to_storage_index::start_job_if_required(runtime_state);

    if let Some(referrer) = referred_by {
        runtime_state.data.user_referral_leaderboards.add_referral(referrer, now);
    }
}

fn welcome_messages() -> Vec<String> {
    const WELCOME_MESSAGES: &[&str] = &[
        "Welcome to OpenChat!",
        "I am the OpenChat bot. I will send you messages to let you know about events that don't belong to any other chat, \
            such as if crypto has been deposited into your OpenChat account(s) or if you've been removed from a group. In \
            the future you'll be able to ask me questions or send me commands.",
        "\
- To follow announcements by the OpenChat team, join [Announcements](/kvvn5-aiaaa-aaaaf-aqznq-cai).
- To ask for help, join [OpenChat Help](/4stss-vaaaa-aaaar-amjda-cai).
- To follow software updates, join [OpenChat Updates](/eucat-raaaa-aaaaf-adn7q-cai).
- To request new features, join [Feature Requests](/vfaj4-zyaaa-aaaaf-aabya-cai).
- To report bugs, join [Bug Reports](/sycha-wyaaa-aaaaf-aabka-cai).
- To provide feedback in general, join the [Product Feedback](/s7dbu-3aaaa-aaaaf-aabkq-cai).
- To view, vote on and discuss governance proposals, join [OpenChat Proposals](/nsbx4-4iaaa-aaaar-afusa-cai).
- To introduce and discuss upcoming proposals, join [OpenChat Roadmap](/n2qig-viaaa-aaaar-ahviq-cai).",
        "Please keep posts relevant to each group. If you just want to say \"hi\", post in the [OpenChat](/vmdca-pqaaa-aaaaf-aabzq-cai) group."];

    WELCOME_MESSAGES.iter().map(|t| t.to_string()).collect()
}

fn validate_public_key(caller: Principal, public_key: &[u8], internet_identity_canister_id: CanisterId) -> Result<(), String> {
    let key_info = SubjectPublicKeyInfo::from_der(public_key).map_err(|e| format!("{e:?}"))?.1;
    let canister_id_length = key_info.subject_public_key.data[0];

    let canister_id = CanisterId::from_slice(&key_info.subject_public_key.data[1..=(canister_id_length as usize)]);
    if canister_id != internet_identity_canister_id {
        return Err("PublicKey is not derived from the InternetIdentity canister".to_string());
    }

    let expected_caller = Principal::self_authenticating(public_key);
    if caller == expected_caller {
        Ok(())
    } else {
        Err("PublicKey does not match caller".to_string())
    }
}

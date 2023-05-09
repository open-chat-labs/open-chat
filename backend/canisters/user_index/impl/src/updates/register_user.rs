use crate::model::pending_payments_queue::{PendingPayment, PendingPaymentReason};
use crate::model::referral_codes::ReferralCode;
use crate::timer_job_types::{JoinUserToGroup, TimerJob};
use crate::updates::set_username::{validate_username, UsernameValidationResult};
use crate::{mutate_state, RuntimeState, ONE_MB, USER_LIMIT};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, UserRegistered, UsernameChanged};
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, Cryptocurrency, MessageContent, TextContent, UserId, Version};
use user_index_canister::register_user_v2::{Response::*, *};
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
        user_wasm_version,
        caller,
        referral_code,
        openchat_bot_messages,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_create_user_args = local_user_index_canister::c2c_create_user::Args {
        principal: caller,
        username: args.username.clone(),
        referred_by: referral_code.as_ref().and_then(|r| r.user()),
        openchat_bot_messages,
    };

    match local_user_index_canister_c2c_client::c2c_create_user(local_user_index_canister, &c2c_create_user_args).await {
        Ok(local_user_index_canister::c2c_create_user::Response::Success(user_id)) => {
            mutate_state(|state| {
                commit(
                    caller,
                    args.username,
                    user_wasm_version,
                    user_id,
                    referral_code,
                    local_user_index_canister,
                    state,
                )
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
    user_wasm_version: Version,
    referral_code: Option<ReferralCode>,
    openchat_bot_messages: Vec<MessageContent>,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let mut referral_code = None;

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
        referral_code = match runtime_state.data.referral_codes.check(code) {
            Some(t) => Some(t),
            None => return Err(ReferralCodeInvalid),
        }
    }

    match validate_username(&args.username) {
        UsernameValidationResult::TooShort(min_length) => return Err(UsernameTooShort(min_length)),
        UsernameValidationResult::TooLong(max_length) => return Err(UsernameTooLong(max_length)),
        UsernameValidationResult::Invalid => return Err(UsernameInvalid),
        _ => {}
    };

    if let Some(local_user_index_canister) = runtime_state.data.local_index_map.index_for_new_user() {
        let user_wasm_version = runtime_state.data.user_canister_wasm.version;
        let openchat_bot_messages = if referral_code
            .as_ref()
            .filter(|c| matches!(c, ReferralCode::BtcMiami(_)))
            .is_some()
        {
            vec![MessageContent::Text(TextContent {
                text: "Congratulations!! Your sats are on their way....".to_string(),
            })]
        } else {
            welcome_messages()
                .into_iter()
                .map(|t| MessageContent::Text(TextContent { text: t }))
                .collect()
        };

        Ok(PrepareOk {
            local_user_index_canister,
            user_wasm_version,
            caller,
            referral_code,
            openchat_bot_messages,
        })
    } else {
        Err(InternalError("All subnets are full".to_string()))
    }
}

fn commit(
    caller: Principal,
    username: String,
    wasm_version: Version,
    user_id: UserId,
    referral_code: Option<ReferralCode>,
    local_user_index_canister_id: CanisterId,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();
    let referred_by = referral_code.as_ref().and_then(|r| r.user());

    let username = match runtime_state.data.users.ensure_unique_username(&username) {
        Ok(_) => username,
        Err(new_username) => {
            runtime_state.push_event_to_local_user_index(
                user_id,
                Event::UsernameChanged(UsernameChanged {
                    user_id,
                    username: new_username.clone(),
                }),
            );
            new_username
        }
    };

    runtime_state
        .data
        .users
        .register(caller, user_id, wasm_version, username.clone(), now, referred_by, false);

    runtime_state
        .data
        .local_index_map
        .add_user(local_user_index_canister_id, user_id);

    runtime_state.push_event_to_all_local_user_indexes(
        Event::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username,
            is_bot: false,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );

    runtime_state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: caller,
        byte_limit: 100 * ONE_MB,
    });

    if let Some(ReferralCode::BtcMiami(code)) = referral_code {
        // This referral code can only be used once so claim it
        runtime_state.data.referral_codes.claim(code, user_id, now);

        runtime_state.queue_payment(PendingPayment {
            amount: 50_000, // Approx $14
            currency: Cryptocurrency::CKBTC,
            timestamp: runtime_state.env.now_nanos(),
            recipient: user_id.into(),
            reason: PendingPaymentReason::BitcoinMiamiReferral,
        });

        let btc_miami_group = Principal::from_text("pbo6v-oiaaa-aaaar-ams6q-cai").unwrap().into();
        runtime_state.data.timer_jobs.enqueue_job(
            TimerJob::JoinUserToGroup(JoinUserToGroup {
                user_id,
                group_id: btc_miami_group,
                attempt: 0,
            }),
            now,
            now,
        );
    }

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

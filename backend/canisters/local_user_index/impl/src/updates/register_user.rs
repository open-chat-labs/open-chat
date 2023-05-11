use crate::model::btc_miami_payments_queue::PendingPayment;
use crate::model::referral_codes::ReferralCode;
use crate::timer_job_types::{JoinUserToGroup, TimerJob};
use crate::updates::c2c_create_user::create_user;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{CanisterId, MessageContent, TextContent, UserId};
use user_index_canister::register_user_v2::{Response::*, *};
use user_index_canister::{Event as UserIndexEvent, UserRegistered};
use utils::username_validation::{validate_username, UsernameValidationError};
use x509_parser::prelude::FromDer;
use x509_parser::x509::SubjectPublicKeyInfo;

pub const USER_LIMIT: usize = 150_000;

#[update]
#[trace]
async fn register_user(args: Args) -> Response {
    // Check the principal is derived from Internet Identity + check the username is valid
    let PrepareOk {
        caller,
        referral_code,
        openchat_bot_messages,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match create_user(local_user_index_canister::c2c_create_user::Args {
        principal: caller,
        username: args.username.clone(),
        referred_by: referral_code.as_ref().and_then(|r| r.user()),
        openchat_bot_messages,
    })
    .await
    {
        local_user_index_canister::c2c_create_user::Response::Success(user_id) => {
            mutate_state(|state| commit(caller, user_id, args.username, referral_code, state));
            Success(user_id)
        }
        local_user_index_canister::c2c_create_user::Response::AlreadyRegistered => AlreadyRegistered,
        local_user_index_canister::c2c_create_user::Response::CyclesBalanceTooLow => CyclesBalanceTooLow,
        local_user_index_canister::c2c_create_user::Response::InternalError(error) => InternalError(error),
    }
}

struct PrepareOk {
    caller: Principal,
    referral_code: Option<ReferralCode>,
    openchat_bot_messages: Vec<MessageContent>,
}

fn prepare(args: &Args, runtime_state: &mut RuntimeState) -> Result<PrepareOk, Response> {
    let caller = runtime_state.env.caller();
    let mut referral_code = None;

    if let Err(error) = validate_public_key(caller, &args.public_key, runtime_state.data.internet_identity_canister_id) {
        return Err(PublicKeyInvalid(error));
    }

    if runtime_state.data.global_users.get_by_principal(&caller).is_some() {
        return Err(AlreadyRegistered);
    }

    if runtime_state.data.global_users.len() >= USER_LIMIT {
        return Err(UserLimitReached);
    }

    if let Some(code) = &args.referral_code {
        referral_code = match runtime_state.data.referral_codes.check(code) {
            Some(t) => Some(t),
            None => return Err(ReferralCodeInvalid),
        }
    }

    match validate_username(&args.username) {
        Ok(_) => {}
        Err(UsernameValidationError::TooShort(min_length)) => return Err(UsernameTooShort(min_length)),
        Err(UsernameValidationError::TooLong(max_length)) => return Err(UsernameTooLong(max_length)),
        Err(UsernameValidationError::Invalid) => return Err(UsernameInvalid),
    };

    let openchat_bot_messages = if referral_code
        .as_ref()
        .filter(|c| matches!(c, ReferralCode::BtcMiami(_)))
        .is_some()
    {
        vec![
            MessageContent::Text(TextContent {
                text: "Congratulations!!".to_string(),
            }),
            MessageContent::Text(TextContent {
                text: format!("Wait here {}, your SATS are coming below 👇", args.username),
            }),
        ]
    } else {
        welcome_messages()
            .into_iter()
            .map(|t| MessageContent::Text(TextContent { text: t }))
            .collect()
    };

    Ok(PrepareOk {
        caller,
        referral_code,
        openchat_bot_messages,
    })
}

fn commit(
    principal: Principal,
    user_id: UserId,
    username: String,
    referral_code: Option<ReferralCode>,
    runtime_state: &mut RuntimeState,
) {
    if let Some(ReferralCode::BtcMiami(code)) = referral_code.clone() {
        let now = runtime_state.env.now();
        let test_mode = runtime_state.data.test_mode;

        // This referral code can only be used once so claim it
        runtime_state.data.referral_codes.claim(code, user_id, now);

        runtime_state.data.btc_miami_payments_queue.push(PendingPayment {
            amount: if test_mode { 50 } else { 50_000 }, // Approx $14
            timestamp: runtime_state.env.now_nanos(),
            recipient: user_id.into(),
        });
        crate::jobs::make_btc_miami_payments::start_job_if_required(runtime_state);

        let btc_miami_group =
            Principal::from_text(if test_mode { "ueyan-5iaaa-aaaaf-bifxa-cai" } else { "pbo6v-oiaaa-aaaar-ams6q-cai" })
                .unwrap()
                .into();
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

    runtime_state.push_event_to_user_index(UserIndexEvent::UserRegistered(Box::new(UserRegistered {
        principal,
        user_id,
        username,
        referred_by: referral_code.and_then(|r| r.user()),
    })));
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

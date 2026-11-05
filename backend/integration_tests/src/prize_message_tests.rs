use crate::env::ENV;
use crate::utils::{now_millis, now_nanos, tick_many, try_metrics};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{HOUR_IN_MS, ICP_SYMBOL, ICP_TRANSFER_FEE, MINUTE_IN_MS, PRIZE_FEE_PERCENT};
use oc_error_codes::OCErrorCode;
use pocket_ic::PocketIc;
use pocket_ic::common::rest::{CanisterHttpReply, CanisterHttpResponse, MockCanisterHttpResponse};
use rand::random;
use sha256::sha256_string;
use std::ops::Deref;
use std::time::Duration;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    CanisterId, ChatEvent, CryptoTransaction, EventIndex, MessageContent, MessageContentInitial, MessageId, MultiUserChat,
    OptionUpdate, PendingCryptoTransaction, PrizeContentInitial, UnitResult, UserId, icrc1,
};

#[test]
fn prize_messages_can_be_claimed_successfully() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let user3 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);
    client::group::happy_path::join_group(env, user3.principal, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = [100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: prize_amount(&prizes, fee),
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                requires_captcha: false,
                min_chit_earned: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );
    if let group_canister::send_message_v2::Response::Success(result) = send_message_response {
        let local_user_index = canister_ids.local_user_index(env, group_id);

        client::local_user_index::happy_path::claim_prize(
            env,
            user2.principal,
            local_user_index,
            MultiUserChat::Group(group_id),
            message_id,
            None,
        );
        let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
        assert_eq!(user2_balance, 200000);

        client::local_user_index::happy_path::claim_prize(
            env,
            user3.principal,
            local_user_index,
            MultiUserChat::Group(group_id),
            message_id,
            None,
        );
        let user3_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user3);
        assert_eq!(user3_balance, 100000);

        let events = client::group::happy_path::thread_events(
            env,
            &user1,
            group_id,
            result.message_index,
            EventIndex::default(),
            true,
            10,
            10,
        );

        let prize_claimed_events = events
            .events
            .into_iter()
            .filter_map(|e| if let ChatEvent::Message(m) = e.event { Some(m) } else { None })
            .filter(|m| matches!(m.content, MessageContent::PrizeWinner(_)))
            .count();

        assert_eq!(prize_claimed_events, 2);
    }
}

#[test]
fn prize_message_requiring_reauthentication() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let (user2, user2_auth) = client::register_user_and_include_auth(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = [100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: prize_amount(&prizes, fee),
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                requires_captcha: true,
                min_chit_earned: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );

    let local_user_index = canister_ids.local_user_index(env, group_id);

    let response = client::local_user_index::claim_prize(
        env,
        user2.principal,
        local_user_index,
        &local_user_index_canister::claim_prize::Args {
            chat_id: MultiUserChat::Group(group_id),
            message_id,
            sign_in_proof_jwt: None,
            turnstile_token: None,
        },
    );

    assert!(
        matches!(response, local_user_index_canister::claim_prize::Response::Error(e) if e.matches_code(OCErrorCode::PrizeUserNotElligible))
    );

    let session_key = random::<[u8; 32]>().to_vec();
    let prepare_delegation_response =
        client::identity::happy_path::prepare_delegation(env, user2_auth.auth_principal(), canister_ids.identity, session_key);

    client::local_user_index::happy_path::claim_prize(
        env,
        user2.principal,
        local_user_index,
        MultiUserChat::Group(group_id),
        message_id,
        Some(prepare_delegation_response.proof_jwt),
    );
    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, 200000);
}

#[test_case(1; "Prize expires")]
#[test_case(2; "Message deleted")]
#[test_case(3; "Message removed due to disappearing messages")]
fn unclaimed_prizes_get_refunded(case: u32) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);

    if case == 3 {
        // Set disappearing messages to 5 minutes
        client::group::happy_path::update_group(
            env,
            user1.principal,
            group_id,
            &group_canister::update_group_v2::Args {
                events_ttl: OptionUpdate::SetToSome(5 * MINUTE_IN_MS),
                ..Default::default()
            },
        );
    }

    client::group::happy_path::join_group(env, user2.principal, group_id);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = vec![100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);
    let message_id = random_from_u128();

    client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                requires_captcha: false,
                min_chit_earned: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    let local_user_index = canister_ids.local_user_index(env, group_id);
    client::local_user_index::happy_path::claim_prize(
        env,
        user2.principal,
        local_user_index,
        MultiUserChat::Group(group_id),
        message_id,
        None,
    );

    let interval = match case {
        1 => HOUR_IN_MS,
        2 => {
            client::group::happy_path::delete_messages(env, user1.principal, group_id, None, vec![message_id]);
            5 * MINUTE_IN_MS
        }
        3 => 5 * MINUTE_IN_MS,
        _ => unreachable!(),
    };

    env.advance_time(Duration::from_millis(interval - 1));
    tick_many(env, 3);

    let user1_balance_before_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1);

    env.advance_time(Duration::from_millis(1));
    tick_many(env, 3);

    let user1_balance_after_refund = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user1);

    assert_eq!(user1_balance_after_refund, user1_balance_before_refund + 105000);
}

#[test]
fn old_transactions_fixed_by_updating_created_date() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);
    let group_id = client::user::happy_path::create_group(env, &user, random_string().as_str(), true, true);

    let starting_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);

    // Send user1 some ICP
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user, 200_000);

    let prizes = vec![100_000];
    let fee = ICP_TRANSFER_FEE;
    let total = prizes.iter().sum::<u128>();
    let amount = total + (fee * prizes.len() as u128) + (total * PRIZE_FEE_PERCENT as u128 / 100);
    let message_id = random_from_u128();

    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes,
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount,
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                requires_captcha: false,
                min_chit_earned: 0,
            }),
            sender_name: user.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );

    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );
    client::stop_canister(env, *controller, canister_ids.icp_ledger);
    env.advance_time(Duration::from_millis(HOUR_IN_MS + 1));
    tick_many(env, 3);
    client::start_canister(env, *controller, canister_ids.icp_ledger);

    // The user paid the prize and the fee for transferring it, plus the fee for approving the group to
    // pull it
    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);
    assert_eq!(user_balance, starting_balance + 75_000 - ICP_TRANSFER_FEE);

    env.advance_time(Duration::from_millis(MINUTE_IN_MS + 1));
    tick_many(env, 3);

    // The unclaimed prize was refunded, less the fee for refunding it
    let user_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user);
    assert_eq!(user_balance, starting_balance + 180_000 - ICP_TRANSFER_FEE);
}

// With a Turnstile secret key set, a claim must carry a token which Cloudflare passes, issued for
// that user's claim of that prize
#[test]
fn prize_claims_are_checked_for_a_human_with_turnstile() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        platform_operator,
        ..
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, random_string().as_str(), true, true);
    client::group::happy_path::join_group(env, user2.principal, group_id);
    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, &user1, 1_000_000_000);

    let prizes = [100000, 200000];
    let fee = ICP_TRANSFER_FEE;
    let message_id = random_from_u128();
    let send_message_response = client::group::send_message_with_transfer(
        env,
        &user1,
        group_id,
        group_canister::send_message_v2::Args {
            thread_root_message_index: None,
            message_id,
            content: MessageContentInitial::Prize(PrizeContentInitial {
                prizes_v2: prizes.into_iter().map(u128::from).collect(),
                transfer: CryptoTransaction::Pending(PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
                    ledger: canister_ids.icp_ledger,
                    token_symbol: ICP_SYMBOL.to_string(),
                    amount: prize_amount(&prizes, fee),
                    to: CanisterId::from(group_id).into(),
                    fee,
                    memo: None,
                    created: now_nanos(env),
                })),
                end_date: now_millis(env) + HOUR_IN_MS,
                caption: None,
                diamond_only: false,
                lifetime_diamond_only: false,
                unique_person_only: false,
                streak_only: 0,
                // So the final claim, made without signing in again, shows a passed token stands in for it
                requires_captcha: true,
                min_chit_earned: 0,
            }),
            sender_name: user1.username(),
            sender_display_name: None,
            replies_to: None,
            mentioned: Vec::new(),
            block_level_markdown: false,
            rules_accepted: None,
            message_filter_failed: None,
            forwarding: false,
            new_achievement: false,
            og_previews: Vec::new(),
        },
    );
    assert!(
        matches!(send_message_response, group_canister::send_message_v2::Response::Success(_)),
        "{send_message_response:?}"
    );

    set_turnstile_config(env, *platform_operator, canister_ids.user_index, Some("secret"));
    wait_for_turnstile_config(env, canister_ids, true);

    let local_user_index = canister_ids.local_user_index(env, group_id);
    let chat_id = MultiUserChat::Group(group_id);

    let response = client::local_user_index::claim_prize(
        env,
        user2.principal,
        local_user_index,
        &local_user_index_canister::claim_prize::Args {
            chat_id,
            message_id,
            sign_in_proof_jwt: None,
            turnstile_token: None,
        },
    );
    assert!(
        matches!(&response, local_user_index_canister::claim_prize::Response::Error(e) if e.matches_code(OCErrorCode::HumanVerificationFailed)),
        "{response:?}"
    );

    // A token Cloudflare passes, but which was issued for another prize
    let other_message_id: MessageId = random_from_u128();
    let response = claim_prize_with_token(
        env,
        &user2,
        local_user_index,
        chat_id,
        message_id,
        &custom_data(user2.user_id, other_message_id),
    );
    assert!(
        matches!(&response, local_user_index_canister::claim_prize::Response::Error(e) if e.matches_code(OCErrorCode::HumanVerificationFailed)),
        "{response:?}"
    );

    let response = claim_prize_with_token(
        env,
        &user2,
        local_user_index,
        chat_id,
        message_id,
        &custom_data(user2.user_id, message_id),
    );
    assert!(
        matches!(response, local_user_index_canister::claim_prize::Response::Success),
        "{response:?}"
    );
    let user2_balance = client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, &user2);
    assert_eq!(user2_balance, 200000);

    // Test envs are pooled, so Turnstile is turned off again
    set_turnstile_config(env, *platform_operator, canister_ids.user_index, None);
    wait_for_turnstile_config(env, canister_ids, false);
}

// The custom data the website's human check (turnstile.js) gives Cloudflare for this claim
fn custom_data(user_id: UserId, message_id: MessageId) -> String {
    sha256_string(format!("{user_id}_{message_id}").as_bytes())
}

// Claims with a new token, answering the LocalUserIndex's call to Cloudflare as Cloudflare would for
// a passed token issued with the custom data `issued_for`
fn claim_prize_with_token(
    env: &mut PocketIc,
    user: &User,
    local_user_index: CanisterId,
    chat_id: MultiUserChat,
    message_id: MessageId,
    issued_for: &str,
) -> local_user_index_canister::claim_prize::Response {
    let token = random_string();
    let call_id = env
        .submit_call(
            local_user_index,
            user.principal,
            "claim_prize_msgpack",
            msgpack::serialize_then_unwrap(local_user_index_canister::claim_prize::Args {
                chat_id,
                message_id,
                sign_in_proof_jwt: None,
                turnstile_token: Some(token.clone()),
            }),
        )
        .unwrap();

    // Other tests' outcalls may still be pending in a pooled env, so only this token's is answered
    let request = (0..20)
        .find_map(|_| {
            env.tick();
            env.get_canister_http().into_iter().find(|request| {
                request.url == "https://challenges.cloudflare.com/turnstile/v0/siteverify"
                    && String::from_utf8_lossy(&request.body).contains(&token)
            })
        })
        .expect("No call to siteverify");
    let body: serde_json::Value = serde_json::from_slice(&request.body).unwrap();
    assert_eq!(body["secret"], "secret");

    let reply = serde_json::json!({
        "success": true,
        "challenge_ts": "2026-11-04T15:00:00.000Z",
        "hostname": "oc.app",
        "error-codes": [],
        "action": "claim_prize",
        "cdata": issued_for,
    });
    env.mock_canister_http_response(MockCanisterHttpResponse {
        subnet_id: request.subnet_id,
        request_id: request.request_id,
        response: CanisterHttpResponse::CanisterHttpReply(CanisterHttpReply {
            status: 200,
            headers: Vec::new(),
            body: serde_json::to_vec(&reply).unwrap(),
        }),
        additional_responses: Vec::new(),
    });

    msgpack::deserialize_then_unwrap(&env.await_call(call_id).unwrap())
}

fn set_turnstile_config(env: &mut PocketIc, platform_operator: Principal, user_index: CanisterId, secret_key: Option<&str>) {
    let response = client::user_index::set_turnstile_config(
        env,
        platform_operator,
        user_index,
        &user_index_canister::set_turnstile_config::Args {
            secret_key: secret_key.map(|k| k.to_string()),
        },
    );
    assert!(matches!(response, UnitResult::Success));
}

// Ticks until the UserIndex and every LocalUserIndex report Turnstile as on (or off), since the
// config is passed on over the UserIndex's event queue
fn wait_for_turnstile_config(env: &mut PocketIc, canister_ids: &CanisterIds, on: bool) {
    let mut canisters = vec![canister_ids.user_index];
    canisters.extend(canister_ids.subnets.iter().map(|s| s.local_user_index));

    let is_on = |env: &PocketIc, canister_id: CanisterId| {
        try_metrics(env, canister_id).map(|m| m["turnstile_secret_key_set"].as_bool() == Some(on))
    };
    for _ in 0..50 {
        if canisters.iter().all(|c| is_on(env, *c) == Some(true)) {
            return;
        }
        env.tick();
    }
    panic!("Turnstile config not passed on to every LocalUserIndex");
}

// What a prize message's transfer must hold: the prizes, a transfer fee for paying out each one and
// OpenChat's fee
fn prize_amount(prizes: &[u64], fee: u128) -> u128 {
    let total = prizes.iter().sum::<u64>() as u128;
    total + fee * prizes.len() as u128 + total * PRIZE_FEE_PERCENT as u128 / 100
}

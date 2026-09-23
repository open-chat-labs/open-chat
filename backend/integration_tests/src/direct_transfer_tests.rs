// Messages holding transfers, and tips, sent to a Group or Community directly rather than via the
// sender's User canister, which the chat canister makes the transfers for. The chat canister never pays from its own account on a member's behalf,
// so these tests pull the sender's funds via ICRC-2, against an approval made under the sender's
// own spender subaccount.

use crate::env::ENV;
use crate::p2p_swap_tests::verify_swap_status;
use crate::utils::{chat_token_info, icp_token_info, now_millis, now_nanos, tick_many};
use crate::{CanisterIds, TestEnv, User, client};
use candid::Principal;
use constants::{DAY_IN_MS, ICP_LEDGER_CANISTER_ID, ICP_SYMBOL, ICP_TRANSFER_FEE, PRIZE_FEE_PERCENT};
use icrc_ledger_types::icrc1::account::Account;
use oc_error_codes::{OCError, OCErrorCode};
use pocket_ic::PocketIc;
use std::ops::Deref;
use test_case::test_case;
use testing::rng::{random_from_u128, random_string};
use types::{
    CanisterId, ChannelId, ChatEvent, ChatId, CommunityId, CryptoContent, CryptoTransaction, EventIndex, Message,
    MessageContent, MessageContentInitial, MessageId, P2PSwapContentInitial, P2PSwapStatus, PendingCryptoTransaction,
    PrizeContentInitial, UnitResult, icrc1, icrc2,
};

const AMOUNT: u128 = 1_000_000;
// What `approve_chat` funds each user's principal with
const FUNDS: u128 = 10_000_000_000;

#[test_case(false; "group")]
#[test_case(true; "channel")]
fn send_crypto_directly_succeeds(in_channel: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, in_channel);

    approve_chat(
        env,
        canister_ids,
        *controller,
        &user1,
        chat,
        user1.principal,
        AMOUNT + ICP_TRANSFER_FEE,
    );

    let transfer = icrc2_transfer(env, user1.principal, icrc1::Account::legacy_for_user(user2.user_id));
    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: user2.user_id,
        transfer: CryptoTransaction::Pending(transfer),
        caption: None,
    });
    let event_index = chat.send_message_with_transfer(env, &user1, content).unwrap();

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        AMOUNT
    );

    let message = chat.message(env, &user2, event_index);
    assert_eq!(message.sender, user1.user_id);
    assert!(matches!(message.content, MessageContent::Crypto(c) if c.recipient == user2.user_id));
}

#[test_case(false; "group")]
#[test_case(true; "channel")]
fn send_prize_directly_succeeds(in_channel: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, chat, .. } = init_test_data(env, canister_ids, *controller, in_channel);

    let prizes = vec![AMOUNT / 2, AMOUNT / 2];
    let amount = AMOUNT + prizes.len() as u128 * ICP_TRANSFER_FEE + AMOUNT * PRIZE_FEE_PERCENT as u128 / 100;
    approve_chat(
        env,
        canister_ids,
        *controller,
        &user1,
        chat,
        user1.principal,
        amount + ICP_TRANSFER_FEE,
    );

    let mut transfer = icrc2_transfer(env, user1.principal, chat.canister_id().into());
    if let PendingCryptoTransaction::ICRC2(t) = &mut transfer {
        t.amount = amount;
    }
    let content = MessageContentInitial::Prize(PrizeContentInitial {
        prizes_v2: prizes,
        transfer: CryptoTransaction::Pending(transfer),
        end_date: now_millis(env) + DAY_IN_MS,
        caption: None,
        diamond_only: false,
        lifetime_diamond_only: false,
        unique_person_only: false,
        streak_only: 0,
        requires_captcha: false,
        min_chit_earned: 0,
    });
    let event_index = chat.send_message_with_transfer(env, &user1, content).unwrap();

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, chat.canister_id()),
        amount
    );
    assert!(matches!(
        chat.message(env, &user1, event_index).content,
        MessageContent::Prize(_)
    ));
}

#[test_case(false; "group")]
#[test_case(true; "channel")]
fn tip_message_directly_succeeds(in_channel: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, in_channel);

    let message_id = random_from_u128();
    let event_index = chat.send_text_message(env, &user2, message_id);

    approve_chat(
        env,
        canister_ids,
        *controller,
        &user1,
        chat,
        user1.principal,
        AMOUNT + ICP_TRANSFER_FEE,
    );

    let transfer = icrc2_transfer(env, user1.principal, icrc1::Account::legacy_for_user(user2.user_id));
    assert!(matches!(
        chat.tip_message(env, &user1, message_id, transfer),
        UnitResult::Success
    ));

    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        AMOUNT
    );
    let message = chat.message(env, &user2, event_index);
    assert_eq!(
        *message.tips.first().unwrap(),
        (ICP_LEDGER_CANISTER_ID, vec![(user1.user_id, AMOUNT)])
    );
}

#[test_case(false; "group")]
#[test_case(true; "channel")]
fn create_p2p_swap_directly_succeeds(in_channel: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, in_channel);

    let token0_amount = 1_000_000_000;
    let token1_amount = 10_000_000_000;
    approve_chat(
        env,
        canister_ids,
        *controller,
        &user1,
        chat,
        user1.principal,
        token0_amount + 2 * ICP_TRANSFER_FEE,
    );
    client::ledger::happy_path::transfer(env, *controller, canister_ids.chat_ledger, user2.user_id, 11_000_000_000);

    let message_id = random_from_u128();
    let content = MessageContentInitial::P2PSwap(P2PSwapContentInitial {
        token0: icp_token_info(),
        token0_amount,
        token1: chat_token_info(),
        token1_amount,
        expires_in: DAY_IN_MS,
        caption: None,
        from_account: Some(user1.principal.into()),
    });
    let event_index = chat
        .send_message_with_transfer_and_id(env, &user1, content, message_id)
        .unwrap();

    tick_many(env, 3);

    chat.accept_p2p_swap(env, &user2, message_id);

    tick_many(env, 10);

    // The swap pays out to the offerer's wallet, which is their User canister's account
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.chat_ledger, user1.user_id),
        token1_amount
    );
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.user_id),
        token0_amount
    );

    verify_swap_status(
        ChatEvent::Message(Box::new(chat.message(env, &user1, event_index))),
        |status| matches!(status, P2PSwapStatus::Completed(c) if c.accepted_by == user2.user_id),
    );
}

#[test]
fn creating_p2p_swap_directly_requires_diamond_membership() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user2, chat, .. } = init_test_data(env, canister_ids, *controller, false);

    approve_chat(
        env,
        canister_ids,
        *controller,
        &user2,
        chat,
        user2.principal,
        AMOUNT + ICP_TRANSFER_FEE,
    );

    let content = MessageContentInitial::P2PSwap(P2PSwapContentInitial {
        token0: icp_token_info(),
        token0_amount: AMOUNT,
        token1: chat_token_info(),
        token1_amount: AMOUNT,
        expires_in: DAY_IN_MS,
        caption: None,
        from_account: Some(user2.principal.into()),
    });
    let error = chat.send_message_with_transfer(env, &user2, content).unwrap_err();

    assert!(error.matches_code(OCErrorCode::NotDiamondMember), "{error:?}");
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.principal),
        FUNDS - ICP_TRANSFER_FEE
    );
}

// An approval is only spent for the user it was made for, so no one can spend an approval another
// member made. Nor can an approval made to the chat canister's default account be spent, since
// whoever called the chat canister could spend it.
#[test_case(true; "approved for another user")]
#[test_case(false; "approved without a spender subaccount")]
fn approval_not_made_for_the_caller_cannot_be_spent(approved_for_another_user: bool) {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, false);

    // User2's funds are approved, and are spent in paying user2 in the first case, user1 in the second
    let (sender, recipient) = if approved_for_another_user {
        approve_chat(
            env,
            canister_ids,
            *controller,
            &user2,
            chat,
            user2.principal,
            AMOUNT + ICP_TRANSFER_FEE,
        );
        (&user1, &user2)
    } else {
        client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, user2.principal, FUNDS);
        client::ledger::happy_path::approve(
            env,
            user2.principal,
            canister_ids.icp_ledger,
            chat.canister_id(),
            AMOUNT + ICP_TRANSFER_FEE,
        );
        (&user2, &user1)
    };

    let transfer = icrc2_transfer(env, user2.principal, icrc1::Account::legacy_for_user(recipient.user_id));
    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: recipient.user_id,
        transfer: CryptoTransaction::Pending(transfer),
        caption: None,
    });
    let error = chat.send_message_with_transfer(env, sender, content).unwrap_err();

    assert!(error.matches_code(OCErrorCode::InsufficientAllowance), "{error:?}");
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, user2.principal),
        FUNDS - ICP_TRANSFER_FEE
    );
}

#[test]
fn transfer_from_the_chat_canisters_own_account_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, false);

    client::ledger::happy_path::transfer(env, *controller, canister_ids.icp_ledger, chat.canister_id(), 1_000_000_000);

    let transfer = PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
        ledger: ICP_LEDGER_CANISTER_ID,
        token_symbol: ICP_SYMBOL.to_string(),
        amount: AMOUNT,
        to: icrc1::Account::legacy_for_user(user2.user_id),
        fee: ICP_TRANSFER_FEE,
        memo: None,
        created: now_nanos(env),
    });
    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: user2.user_id,
        transfer: CryptoTransaction::Pending(transfer),
        caption: None,
    });
    let error = chat.send_message_with_transfer(env, &user1, content).unwrap_err();

    assert!(error.matches_code(OCErrorCode::InvalidRequest), "{error:?}");
    assert_eq!(
        client::ledger::happy_path::balance_of(env, canister_ids.icp_ledger, chat.canister_id()),
        1_000_000_000
    );
}

#[test]
fn transfer_to_someone_other_than_the_recipient_is_rejected() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        ..
    } = wrapper.env();

    let TestData { user1, user2, chat } = init_test_data(env, canister_ids, *controller, false);

    approve_chat(
        env,
        canister_ids,
        *controller,
        &user1,
        chat,
        user1.principal,
        AMOUNT + ICP_TRANSFER_FEE,
    );

    // The message says it pays user2, but the funds would go to user1's own OpenChat account
    let transfer = icrc2_transfer(env, user1.principal, icrc1::Account::legacy_for_user(user1.user_id));
    let content = MessageContentInitial::Crypto(CryptoContent {
        recipient: user2.user_id,
        transfer: CryptoTransaction::Pending(transfer),
        caption: None,
    });
    let error = chat.send_message_with_transfer(env, &user1, content).unwrap_err();

    assert!(error.matches_code(OCErrorCode::RecipientMismatch), "{error:?}");
}

struct TestData {
    user1: User,
    user2: User,
    chat: DirectChat,
}

// User1 is a Diamond member, and both users are members of the chat
fn init_test_data(env: &mut PocketIc, canister_ids: &CanisterIds, controller: Principal, in_channel: bool) -> TestData {
    let user1 = client::register_diamond_user(env, canister_ids, controller);
    let user2 = client::register_user(env, canister_ids);

    let chat = if in_channel {
        let community_id =
            client::user::happy_path::create_community(env, &user1, &random_string(), true, vec![random_string()]);
        let channel_id =
            client::community::happy_path::create_channel(env, user1.principal, community_id, true, random_string());
        client::community::happy_path::join_community(env, user2.principal, community_id);
        client::community::happy_path::join_channel(env, user2.principal, community_id, channel_id);
        DirectChat::Channel(community_id, channel_id)
    } else {
        let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), true, true);
        client::group::happy_path::join_group(env, user2.principal, group_id);
        DirectChat::Group(group_id)
    };

    tick_many(env, 3);

    TestData { user1, user2, chat }
}

// Funds the user's principal, then approves the chat canister to spend `amount` of it for the user
// signing in with `spender`,
// which costs the user a fee
fn approve_chat(
    env: &mut PocketIc,
    canister_ids: &CanisterIds,
    controller: Principal,
    user: &User,
    chat: DirectChat,
    spender: Principal,
    amount: u128,
) {
    client::ledger::happy_path::transfer(env, controller, canister_ids.icp_ledger, user.principal, FUNDS);
    client::ledger::happy_path::approve(
        env,
        user.principal,
        canister_ids.icp_ledger,
        Account {
            owner: chat.canister_id(),
            subaccount: Some(ledger_utils::spender_subaccount(spender)),
        },
        amount,
    );
}

fn icrc2_transfer(env: &PocketIc, from: Principal, to: icrc1::Account) -> PendingCryptoTransaction {
    PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
        ledger: ICP_LEDGER_CANISTER_ID,
        token_symbol: ICP_SYMBOL.to_string(),
        amount: AMOUNT,
        from: from.into(),
        to,
        fee: ICP_TRANSFER_FEE,
        memo: None,
        created: now_nanos(env),
    })
}

// A group, or a channel in a community, which the tests send to directly
#[derive(Clone, Copy)]
enum DirectChat {
    Group(ChatId),
    Channel(CommunityId, ChannelId),
}

impl DirectChat {
    fn canister_id(&self) -> CanisterId {
        match self {
            DirectChat::Group(group_id) => (*group_id).into(),
            DirectChat::Channel(community_id, _) => (*community_id).into(),
        }
    }

    fn send_message_with_transfer(
        &self,
        env: &mut PocketIc,
        sender: &User,
        content: MessageContentInitial,
    ) -> Result<EventIndex, OCError> {
        self.send_message_with_transfer_and_id(env, sender, content, random_from_u128())
    }

    fn send_message_with_transfer_and_id(
        &self,
        env: &mut PocketIc,
        sender: &User,
        content: MessageContentInitial,
        message_id: MessageId,
    ) -> Result<EventIndex, OCError> {
        match self {
            DirectChat::Group(group_id) => {
                use group_canister::send_message_v2::*;
                let args = Args {
                    thread_root_message_index: None,
                    message_id,
                    content,
                    sender_name: sender.username(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned: Vec::new(),
                    forwarding: false,
                    block_level_markdown: false,
                    rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                    og_previews: Vec::new(),
                };
                match client::group::send_message_v2(env, sender.principal, (*group_id).into(), &args) {
                    Response::Success(result) => {
                        assert!(result.transfer.is_some());
                        Ok(result.event_index)
                    }
                    Response::Error(error) => Err(error),
                }
            }
            DirectChat::Channel(community_id, channel_id) => {
                use community_canister::send_message::*;
                let args = Args {
                    channel_id: *channel_id,
                    thread_root_message_index: None,
                    message_id,
                    content,
                    sender_name: sender.username(),
                    sender_display_name: None,
                    replies_to: None,
                    mentioned: Vec::new(),
                    forwarding: false,
                    block_level_markdown: false,
                    community_rules_accepted: None,
                    channel_rules_accepted: None,
                    message_filter_failed: None,
                    new_achievement: false,
                    og_previews: Vec::new(),
                };
                match client::community::send_message(env, sender.principal, (*community_id).into(), &args) {
                    Response::Success(result) => {
                        assert!(result.transfer.is_some());
                        Ok(result.event_index)
                    }
                    Response::Error(error) => Err(error),
                }
            }
        }
    }

    fn tip_message(
        &self,
        env: &mut PocketIc,
        sender: &User,
        message_id: MessageId,
        transfer: PendingCryptoTransaction,
    ) -> UnitResult {
        match self {
            DirectChat::Group(group_id) => client::group::tip_message(
                env,
                sender.principal,
                (*group_id).into(),
                &group_canister::tip_message::Args {
                    thread_root_message_index: None,
                    message_id,
                    transfer,
                    decimals: 8,
                    username: sender.username(),
                    display_name: None,
                    new_achievement: true,
                },
            ),
            DirectChat::Channel(community_id, channel_id) => client::community::tip_message(
                env,
                sender.principal,
                (*community_id).into(),
                &community_canister::tip_message::Args {
                    channel_id: *channel_id,
                    thread_root_message_index: None,
                    message_id,
                    transfer,
                    decimals: 8,
                    username: sender.username(),
                    display_name: None,
                    new_achievement: true,
                },
            ),
        }
    }

    fn send_text_message(&self, env: &mut PocketIc, sender: &User, message_id: MessageId) -> EventIndex {
        match self {
            DirectChat::Group(group_id) => {
                client::group::happy_path::send_text_message(env, sender, *group_id, None, "TEXT", Some(message_id)).event_index
            }
            DirectChat::Channel(community_id, channel_id) => {
                client::community::happy_path::send_text_message(
                    env,
                    sender,
                    *community_id,
                    *channel_id,
                    None,
                    "TEXT",
                    Some(message_id),
                )
                .event_index
            }
        }
    }

    fn accept_p2p_swap(&self, env: &mut PocketIc, sender: &User, message_id: MessageId) {
        match self {
            DirectChat::Group(group_id) => client::group::happy_path::accept_p2p_swap(env, sender, *group_id, message_id),
            DirectChat::Channel(community_id, channel_id) => {
                client::community::happy_path::accept_p2p_swap(env, sender, *community_id, *channel_id, message_id)
            }
        }
    }

    fn message(&self, env: &PocketIc, user: &User, event_index: EventIndex) -> Message {
        let event = match self {
            DirectChat::Group(group_id) => client::group::happy_path::events_by_index(env, user, *group_id, vec![event_index]),
            DirectChat::Channel(community_id, channel_id) => {
                client::community::happy_path::events_by_index(env, user, *community_id, *channel_id, vec![event_index])
            }
        }
        .events
        .pop()
        .unwrap()
        .event;

        let ChatEvent::Message(message) = event else {
            panic!("Event is not a message: {event:?}")
        };
        *message
    }
}

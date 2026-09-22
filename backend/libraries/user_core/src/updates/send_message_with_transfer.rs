use crate::User;
use constants::{MEMO_MESSAGE, MEMO_PRIZE, PRIZE_FEE_PERCENT};
use oc_error_codes::OCErrorCode;
use tracing::error;
use types::{
    Achievement, Chat, CryptoTransaction, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE, MessageContentInitial, MessageId,
    MessageIndex, OCResult, P2PSwapLocation, PendingCryptoTransaction, PinNumberWrapper, TimestampMillis, UserId, icrc1,
};

// What must happen before the message can be sent: the transfer it carries, or the P2P swap to set
// up with the escrow canister, whose deposit is then the transfer
pub enum Prepared {
    Transfer(PendingCryptoTransaction),
    P2PSwap(Box<escrow_canister::create_swap::Args>, Option<icrc1::Account>),
}

// Checks a message carrying a crypto transfer, prize or P2P swap for a group or channel, returning
// what to make or set up before sending it. The caller has already checked the user is a member.
#[expect(clippy::too_many_arguments)]
pub fn prepare(
    user: &mut User,
    my_user_id: UserId,
    chat: Chat,
    thread_root_message_index: Option<MessageIndex>,
    message_id: MessageId,
    content: &MessageContentInitial,
    mut pin: Option<PinNumberWrapper>,
    now: TimestampMillis,
) -> OCResult<Prepared> {
    user.verify_not_suspended()?;

    if content.text_length() > MAX_TEXT_LENGTH_USIZE {
        return Err(OCErrorCode::TextTooLong.with_message(MAX_TEXT_LENGTH));
    }

    user.pin_number.verify(pin.as_mut(), now)?;

    let pending_transaction = match content {
        MessageContentInitial::Crypto(c) => {
            if c.recipient == my_user_id {
                return Err(OCErrorCode::TransferCannotBeToSelf.into());
            }
            if user.blocked_users.contains(&c.recipient) {
                return Err(OCErrorCode::TargetUserBlocked.into());
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => t.clone().set_memo(&MEMO_MESSAGE),
                _ => return Err(OCErrorCode::InvalidRequest.with_message("Transaction must be of type 'Pending'")),
            }
        }
        MessageContentInitial::Prize(c) => {
            if thread_root_message_index.is_some() {
                return Err(OCErrorCode::InvalidRequest.with_message("Prize messages cannot be sent within threads"));
            }
            if c.end_date <= now {
                return Err(OCErrorCode::InvalidRequest.with_message("Prize end date must be in the future"));
            }
            match &c.transfer {
                CryptoTransaction::Pending(t) => {
                    let total_prizes = c.prizes_v2.iter().sum::<u128>();
                    let total_transfer_fees = c.prizes_v2.len() as u128 * t.fee();
                    let oc_fee = (total_prizes * PRIZE_FEE_PERCENT as u128) / 100;
                    let total_amount_to_send_old = total_prizes + total_transfer_fees;
                    let total_amount_to_send = total_prizes + total_transfer_fees + oc_fee;
                    let transaction_amount = t.units();

                    if transaction_amount != total_amount_to_send && transaction_amount != total_amount_to_send_old {
                        error!(
                            ?total_amount_to_send,
                            ?transaction_amount,
                            "Expected vs Actual prize transfer"
                        );
                        return Err(
                            OCErrorCode::InvalidRequest.with_message("Transaction amount must equal total prizes + total fees")
                        );
                    }

                    t.clone().set_memo(&MEMO_PRIZE)
                }
                _ => return Err(OCErrorCode::InvalidRequest.with_message("Transaction must be of type 'Pending'")),
            }
        }
        MessageContentInitial::P2PSwap(p) => {
            if !user.membership(now).is_diamond_member() {
                return Err(OCErrorCode::NotDiamondMember.into());
            }
            ledger_utils::validate_from_account(p.from_account, my_user_id.canister_id())?;

            let chat_canister_id = chat.canister_id();
            let create_swap_args = escrow_canister::create_swap::Args {
                location: P2PSwapLocation::from_message(chat, thread_root_message_index, message_id),
                token0: p.token0.clone(),
                token0_amount: p.token0_amount,
                token0_principal: Some(my_user_id.as_principal()),
                token1: p.token1.clone(),
                token1_amount: p.token1_amount,
                token1_principal: None,
                expires_at: now + p.expires_in,
                additional_admins: vec![chat_canister_id],
                canister_to_notify: Some(chat_canister_id),
                user_to_notify: None,
                is_public: false,
            };
            return Ok(Prepared::P2PSwap(Box::new(create_swap_args), p.from_account));
        }
        _ => return Err(OCErrorCode::InvalidRequest.with_message("Message must include a crypto transfer")),
    };

    if !pending_transaction.is_zero() {
        Ok(Prepared::Transfer(pending_transaction))
    } else {
        Err(OCErrorCode::TransferCannotBeZero.into())
    }
}

// The achievements sending the message earns: one for its type of content, and one for a quote
// reply or for starting a thread
pub fn achievements(
    message_type_achievement: Option<Achievement>,
    message_index: MessageIndex,
    in_thread: bool,
    quote_reply: bool,
) -> Vec<Achievement> {
    let mut achievements = Vec::new();
    if let Some(achievement) = message_type_achievement {
        achievements.push(achievement);
    }
    if quote_reply {
        achievements.push(Achievement::QuoteReplied);
    } else if in_thread && message_index == MessageIndex::from(0) {
        achievements.push(Achievement::RepliedInThread);
    }
    achievements
}

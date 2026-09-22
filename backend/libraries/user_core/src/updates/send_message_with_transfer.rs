use crate::{P2PSwap, User};
use constants::{MEMO_MESSAGE, MEMO_P2P_SWAP_CREATE, MEMO_PRIZE, NANOS_PER_MILLISECOND, PRIZE_FEE_PERCENT};
use escrow_canister::deposit_subaccount;
use oc_error_codes::{OCError, OCErrorCode};
use tracing::error;
use types::{
    Achievement, CanisterId, Chat, CryptoTransaction, MAX_TEXT_LENGTH, MAX_TEXT_LENGTH_USIZE, MessageContentInitial, MessageId,
    MessageIndex, OCResult, P2PSwapLocation, PendingCryptoTransaction, PinNumberWrapper, TimestampMillis, UserId, icrc1, icrc2,
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

pub enum SetUpP2PSwapError {
    InvalidSwap(String),
    InternalError(String),
    Error(OCError),
}

impl From<SetUpP2PSwapError> for OCError {
    fn from(value: SetUpP2PSwapError) -> Self {
        match value {
            SetUpP2PSwapError::InvalidSwap(message) => OCErrorCode::InvalidRequest.with_message(message),
            SetUpP2PSwapError::InternalError(error) => OCErrorCode::Unknown.with_message(error),
            SetUpP2PSwapError::Error(error) => error,
        }
    }
}

// Creates the swap in the escrow canister, returning its id
pub async fn create_p2p_swap(
    escrow_canister_id: CanisterId,
    args: &escrow_canister::create_swap::Args,
) -> Result<u32, SetUpP2PSwapError> {
    use SetUpP2PSwapError::*;
    match escrow_canister_c2c_client::create_swap(escrow_canister_id, args).await {
        Ok(escrow_canister::create_swap::Response::Success(result)) => Ok(result.id),
        Ok(escrow_canister::create_swap::Response::Error(error)) => Err(Error(error)),
        Ok(escrow_canister::create_swap::Response::InvalidSwap(message)) => Err(InvalidSwap(message)),
        Err(error) => Err(InternalError(format!("{error:?}"))),
    }
}

// The swap to record against the user who offered it, and their deposit of token0 into the escrow
// canister: from the account they approved (the allowance is what authorises this, so there is
// nothing to check here) or else their own
pub fn p2p_swap_deposit(
    escrow_canister_id: CanisterId,
    my_user_id: UserId,
    id: u32,
    args: escrow_canister::create_swap::Args,
    from_account: Option<icrc1::Account>,
    now: TimestampMillis,
) -> (P2PSwap, PendingCryptoTransaction) {
    let swap = P2PSwap {
        id,
        location: args.location,
        created_by: my_user_id,
        created: now,
        token0: args.token0.clone(),
        token0_amount: args.token0_amount,
        token1: args.token1,
        token1_amount: args.token1_amount,
        expires_at: args.expires_at,
    };
    let to = icrc1::Account {
        owner: escrow_canister_id,
        subaccount: Some(deposit_subaccount(my_user_id.as_principal(), id)),
    };
    let deposit = match from_account {
        Some(from) => PendingCryptoTransaction::ICRC2(icrc2::PendingCryptoTransaction {
            ledger: args.token0.ledger,
            token_symbol: args.token0.symbol,
            amount: args.token0_amount + args.token0.fee,
            from,
            to,
            fee: args.token0.fee,
            memo: Some(MEMO_P2P_SWAP_CREATE.to_vec().into()),
            created: now * NANOS_PER_MILLISECOND,
        }),
        None => PendingCryptoTransaction::ICRC1(icrc1::PendingCryptoTransaction {
            ledger: args.token0.ledger,
            token_symbol: args.token0.symbol,
            amount: args.token0_amount + args.token0.fee,
            to,
            fee: args.token0.fee,
            memo: Some(MEMO_P2P_SWAP_CREATE.to_vec().into()),
            created: now * NANOS_PER_MILLISECOND,
        }),
    };
    (swap, deposit)
}

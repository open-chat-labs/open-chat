use candid::Principal;
use ic_ledger_types::{Memo, Timestamp, Tokens, TransferArgs, DEFAULT_FEE};
use ledger_utils::{calculate_transaction_hash, default_ledger_account};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis, TransactionHash, UserId};

#[derive(Serialize, Deserialize)]
pub struct RewardCodes {
    this_canister_id: CanisterId,
    codes: HashMap<String, RewardCode>,
    claimed: HashMap<UserId, String>,
}

impl RewardCodes {
    pub fn new(this_canister_id: CanisterId) -> RewardCodes {
        RewardCodes {
            this_canister_id,
            codes: HashMap::default(),
            claimed: HashMap::default(),
        }
    }

    pub fn add(
        &mut self,
        code: String,
        amount: Tokens,
        added_by: Principal,
        expiry: Option<TimestampMillis>,
        now: TimestampMillis,
    ) -> bool {
        match self.codes.entry(code) {
            Vacant(e) => {
                e.insert(RewardCode {
                    amount,
                    added: now,
                    added_by,
                    expiry,
                    claimed_by: None,
                });
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn claim(&mut self, code: String, user_id: UserId, now: TimestampMillis) -> ClaimRewardCodeResult {
        match self.claimed.entry(user_id) {
            Occupied(_) => ClaimRewardCodeResult::UserAlreadyClaimed,
            Vacant(e) => {
                if let Some(c) = self.codes.get_mut(&code) {
                    if c.expiry.map_or(false, |ts| now > ts) {
                        ClaimRewardCodeResult::CodeExpired
                    } else if c.claimed_by.is_some() {
                        ClaimRewardCodeResult::CodeAlreadyClaimed
                    } else {
                        let transfer_args = TransferArgs {
                            memo: Memo(0),
                            amount: c.amount,
                            fee: DEFAULT_FEE,
                            from_subaccount: None,
                            to: default_ledger_account(user_id.into()),
                            created_at_time: Some(Timestamp {
                                timestamp_nanos: now * 1000 * 1000,
                            }),
                        };
                        let transaction_hash = calculate_transaction_hash(self.this_canister_id, &transfer_args);

                        c.claimed_by = Some((user_id, transaction_hash, now));
                        e.insert(code);

                        ClaimRewardCodeResult::Success(transfer_args, transaction_hash)
                    }
                } else {
                    ClaimRewardCodeResult::CodeNotFound
                }
            }
        }
    }

    pub fn validate(text: &str) -> bool {
        text.len() == 8 && text.chars().all(|c| c.is_ascii_alphanumeric())
    }
}

pub enum ClaimRewardCodeResult {
    Success(TransferArgs, TransactionHash),
    UserAlreadyClaimed,
    CodeAlreadyClaimed,
    CodeExpired,
    CodeNotFound,
}

#[derive(Serialize, Deserialize)]
struct RewardCode {
    amount: Tokens,
    added: TimestampMillis,
    added_by: Principal,
    expiry: Option<TimestampMillis>,
    claimed_by: Option<(UserId, TransactionHash, TimestampMillis)>,
}

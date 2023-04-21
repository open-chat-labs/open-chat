use std::collections::{hash_map::Entry, HashMap};

use candid::{Deserialize, Principal};
use serde::Serialize;
use types::{TimestampMillis, UserId};
use user_index_canister::add_referral_codes::ReferralType;

#[derive(Serialize, Deserialize, Clone)]
pub enum ReferralCode {
    BtcMiami(String),
    User(UserId),
}

impl ReferralCode {
    pub fn user(&self) -> Option<UserId> {
        match self {
            ReferralCode::BtcMiami(_) => None,
            ReferralCode::User(user_id) => Some(*user_id),
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct ReferralCodes {
    codes: HashMap<String, ReferralCodeDetails>,
}

#[derive(Serialize, Deserialize)]
pub struct ReferralCodeDetails {
    referral_type: ReferralType,
    created: TimestampMillis,
    claimed: Option<ReferralCodeClaim>,
}

#[derive(Serialize, Deserialize)]
pub struct ReferralCodeClaim {
    when: TimestampMillis,
    who: UserId,
}

#[derive(Serialize, Debug, Default)]
pub struct ReferralTypeMetrics {
    pub claimed: usize,
    pub total: usize,
}

impl ReferralCodes {
    pub fn add(&mut self, referral_type: ReferralType, code: String, now: TimestampMillis) -> bool {
        match self.codes.entry(code) {
            Entry::Occupied(_) => false,
            Entry::Vacant(e) => {
                e.insert(ReferralCodeDetails {
                    referral_type,
                    created: now,
                    claimed: None,
                });
                true
            }
        }
    }

    pub fn claim(&mut self, code: String, user_id: UserId, now: TimestampMillis) -> bool {
        match self.codes.entry(code) {
            Entry::Occupied(mut e) => {
                let details = e.get_mut();
                match details.claimed {
                    Some(_) => false,
                    None => {
                        details.claimed = Some(ReferralCodeClaim { when: now, who: user_id });
                        true
                    }
                }
            }
            Entry::Vacant(_) => false,
        }
    }

    pub fn check(&self, code: &String) -> Option<ReferralCode> {
        if code.len() > 100 {
            return None;
        }

        if let Some(details) = self.codes.get(code) {
            match details.claimed {
                Some(_) => None,
                None => Some(ReferralCode::BtcMiami(code.clone())),
            }
        } else if let Ok(user_id) = Principal::from_text(code).map(|p| p.into()) {
            Some(ReferralCode::User(user_id))
        } else {
            None
        }
    }

    pub fn metrics(&self) -> HashMap<ReferralType, ReferralTypeMetrics> {
        let mut metrics = HashMap::new();

        for details in self.codes.values() {
            let ms: &mut ReferralTypeMetrics = metrics.entry(details.referral_type.clone()).or_default();
            ms.total += 1;
            if details.claimed.is_some() {
                ms.claimed += 1;
            }
        }

        metrics
    }
}

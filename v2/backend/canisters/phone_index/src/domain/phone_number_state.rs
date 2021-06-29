use candid::Principal;
use shared::time::TimestampMillis;

pub enum PhoneNumberState {
    Unclaimed(UnclaimedPhoneNumberState),
    Claimed(ClaimedPhoneNumberState),
}

pub struct UnclaimedPhoneNumberState {
    principal: Principal,
    confirmation_code: String,
    date_generated: TimestampMillis,
}

pub struct ClaimedPhoneNumberState {
    principal: Principal,
    date_claimed: TimestampMillis,
}

impl PhoneNumberState {
    pub fn get_principal(&self) -> Principal {
        match self {
            PhoneNumberState::Unclaimed(s) => s.get_principal(),
            PhoneNumberState::Claimed(s) => s.get_principal()
        }
    }
}

impl UnclaimedPhoneNumberState {
    pub fn new(
        principal: Principal,
        confirmation_code: String,
        date_generated: TimestampMillis) -> UnclaimedPhoneNumberState {

        UnclaimedPhoneNumberState {
            principal,
            confirmation_code,
            date_generated,
        }
    }

    pub fn get_principal(&self) -> Principal {
        self.principal
    }

    pub fn get_confirmation_code(&self) -> &str {
        &self.confirmation_code
    }

    pub fn get_date_generated(&self) -> TimestampMillis {
        self.date_generated
    }
}

impl ClaimedPhoneNumberState {
    pub fn new(principal: Principal, date_claimed: TimestampMillis) -> ClaimedPhoneNumberState {
        ClaimedPhoneNumberState {
            principal,
            date_claimed
        }
    }

    pub fn get_principal(&self) -> Principal {
        self.principal
    }

    #[allow(dead_code)]
    pub fn get_date_claimed(&self) -> TimestampMillis {
        self.date_claimed
    }
}

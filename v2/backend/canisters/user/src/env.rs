use candid::Principal;
use shared::time::TimestampMillis;
use shared::types::UserId;

pub trait Environment {
    fn now(&self) -> TimestampMillis;
    fn caller(&self) -> Principal;
    fn owner_user_id(&self) -> UserId;
}

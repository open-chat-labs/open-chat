use shared::time::TimestampMillis;
use candid::Principal;

pub trait Environment {
    /// Returns the current time, in milliseconds since the epoch.
    fn now(&self) -> TimestampMillis;

    /// Returns the caller's principal.
    fn caller(&self) -> Principal;

    /// Returns a random number.
    ///
    /// This number is the same in all replicas.
    fn random_u32(&mut self) -> u32;
}

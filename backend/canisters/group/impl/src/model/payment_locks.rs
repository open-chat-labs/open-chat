use crate::mutate_state;
use std::collections::HashSet;
use types::UserId;

// Guards against a single user having more than one gated-join payment in progress at a time.
//
// Joining a payment gated group makes an async call to transfer tokens from the user partway through
// the join. If a user triggers the join twice in quick succession, both calls can take the payment
// before either has recorded the user as a member, resulting in the user being charged multiple
// times but only joining once. Acquiring the lock before taking the payment prevents this.
#[derive(Default)]
pub struct PaymentLocks {
    locked: HashSet<UserId>,
}

impl PaymentLocks {
    // Returns `None` if there is already a payment in progress for this user, else acquires the lock
    // and returns a guard which releases it when dropped.
    pub fn acquire(&mut self, user_id: UserId) -> Option<PaymentLockGuard> {
        self.locked.insert(user_id).then_some(PaymentLockGuard { user_id })
    }

    fn release(&mut self, user_id: &UserId) {
        self.locked.remove(user_id);
    }
}

// Releases the lock when dropped, ensuring it is released regardless of which path the join takes to
// return. Can only be obtained via `PaymentLocks::acquire`.
pub struct PaymentLockGuard {
    user_id: UserId,
}

impl Drop for PaymentLockGuard {
    fn drop(&mut self) {
        let user_id = self.user_id;
        // Silently failing to release the lock would leave the user permanently locked out, so
        // release it unconditionally - if the state is already borrowed this will panic, failing
        // loudly, but that would be a bug (guards must not be dropped within a state closure)
        mutate_state(|state| state.data.payment_locks.release(&user_id));
    }
}

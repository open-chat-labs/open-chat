use std::cell::RefCell;
use std::collections::HashSet;
use types::UserId;

thread_local! {
    static LOCKED: RefCell<HashSet<UserId>> = RefCell::default();
}

// Guards against a single user having more than one gated-join payment in progress at a time.
//
// Joining a payment gated group, community or channel makes an async call to transfer tokens from
// the user partway through the join. If a user triggers the join twice in quick succession, both
// calls can take the payment before either has recorded the user as a member, resulting in the user
// being charged multiple times but only joining once. Acquiring the lock before taking the payment
// prevents this.
//
// The set of locked users is stored in a thread local rather than in the canister state, so
// releasing the lock on drop cannot conflict with a borrow of the canister state. Like the rest of
// the heap it is rolled back if the current message traps, and it is (deliberately) cleared by
// canister upgrades.
pub struct PaymentLockGuard {
    user_id: UserId,
}

impl PaymentLockGuard {
    // Returns `None` if there is already a payment in progress for this user, else acquires the
    // lock, which is released when the guard is dropped.
    pub fn acquire(user_id: UserId) -> Option<PaymentLockGuard> {
        LOCKED.with_borrow_mut(|locked| locked.insert(user_id).then_some(PaymentLockGuard { user_id }))
    }
}

impl Drop for PaymentLockGuard {
    fn drop(&mut self) {
        LOCKED.with_borrow_mut(|locked| locked.remove(&self.user_id));
    }
}

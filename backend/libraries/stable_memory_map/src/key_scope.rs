//! In a canister which holds many users, each user is assigned an index, and every key in the
//! stable memory map is prefixed with the index of the user it belongs to. This keeps two users'
//! keys from ever colliding, and keeps each user's entries contiguous, so that a user's data can
//! be ranged over or deleted as a whole.
//!
//! The index is applied at the boundary of the map, as keys are passed in and handed back out,
//! rather than being part of the key types. So the key types, the code which builds them and the
//! code which reads them back are exactly the same as in a canister which holds a single user,
//! where nothing is added. Which of the two applies is fixed when the map is initialised.
//!
//! The scope to apply is set with `with_key_scope`. In a multi-user canister every access to the
//! map must happen within one, and accessing the map outside of one panics.

use crate::BaseKey;
use std::cell::Cell;
use std::ops::Bound;
use types::MAX_USER_INDEX;

const SCOPE_LEN: usize = 2;

// No user index can be this high, and it sorts after every user index, so the canister's own
// entries sit after every user's
const CANISTER_SCOPE: [u8; SCOPE_LEN] = [u8::MAX, u8::MAX];

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum KeyScope {
    // The user with this index within the canister
    User(u16),
    // Entries which belong to the canister as a whole rather than to any one user
    Canister,
}

impl KeyScope {
    fn to_bytes(self) -> [u8; SCOPE_LEN] {
        match self {
            KeyScope::User(index) => {
                assert!(index <= MAX_USER_INDEX, "User index {index} is out of range");
                index.to_be_bytes()
            }
            KeyScope::Canister => CANISTER_SCOPE,
        }
    }

    // The bytes which sort immediately after every key in this scope, or `None` if no key can
    // sort after them
    fn end_bytes(self) -> Option<[u8; SCOPE_LEN]> {
        match self {
            KeyScope::User(index) => Some((index + 1).to_be_bytes()),
            KeyScope::Canister => None,
        }
    }
}

thread_local! {
    // Whether this canister holds many users, and so scopes its keys. Fixed at init.
    static SCOPED: Cell<bool> = const { Cell::new(false) };
    // The scope applied to every key while `with_key_scope` runs
    static CURRENT: Cell<Option<KeyScope>> = const { Cell::new(None) };
}

pub(crate) fn set_scoped(scoped: bool) {
    SCOPED.set(scoped);
    CURRENT.set(None);
}

// Runs `f` with every key passed to or returned from the map scoped to `scope`. Calls can be
// nested, in which case the outer scope is restored once the inner one has run.
pub fn with_key_scope<R>(scope: KeyScope, f: impl FnOnce() -> R) -> R {
    assert!(
        SCOPED.get(),
        "Keys are only scoped in a canister initialised with `init_multi_user`"
    );
    let _restore = RestoreScope(CURRENT.replace(Some(scope)));
    f()
}

struct RestoreScope(Option<KeyScope>);

impl Drop for RestoreScope {
    fn drop(&mut self) {
        CURRENT.set(self.0);
    }
}

// The scope to apply, or `None` in a canister which holds a single user
fn current() -> Option<KeyScope> {
    SCOPED.get().then(|| {
        CURRENT
            .get()
            .expect("The stable memory map must be accessed within `with_key_scope` in a multi-user canister")
    })
}

pub(crate) fn scope_key(key: BaseKey) -> BaseKey {
    match current() {
        Some(scope) => prepend(scope.to_bytes(), key),
        None => key,
    }
}

// Strips the scope from a key read from the map. Ranges never leave the current scope, so every
// key read back carries it.
pub(crate) fn unscope_key(key: BaseKey) -> BaseKey {
    if SCOPED.get() { BaseKey::new(key.into_vec()[SCOPE_LEN..].to_vec()) } else { key }
}

// Scopes both bounds of a range. An unbounded side would otherwise run into the neighbouring
// scope's entries, so it is replaced with the edge of the current scope.
pub(crate) fn scope_range(start: Bound<BaseKey>, end: Bound<BaseKey>) -> (Bound<BaseKey>, Bound<BaseKey>) {
    let Some(scope) = current() else {
        return (start, end);
    };
    let scope_bytes = scope.to_bytes();

    let start = match start {
        Bound::Included(key) => Bound::Included(prepend(scope_bytes, key)),
        Bound::Excluded(key) => Bound::Excluded(prepend(scope_bytes, key)),
        Bound::Unbounded => Bound::Included(BaseKey::new(scope_bytes.to_vec())),
    };
    let end = match end {
        Bound::Included(key) => Bound::Included(prepend(scope_bytes, key)),
        Bound::Excluded(key) => Bound::Excluded(prepend(scope_bytes, key)),
        Bound::Unbounded => match scope.end_bytes() {
            Some(bytes) => Bound::Excluded(BaseKey::new(bytes.to_vec())),
            None => Bound::Unbounded,
        },
    };
    (start, end)
}

// The first key in the scope of the user at `index`, and the first key after it
pub(crate) fn user_scope_bounds(index: u16) -> (BaseKey, BaseKey) {
    let scope = KeyScope::User(index);
    let end = scope.end_bytes().expect("A user's scope is always followed by another");
    (BaseKey::new(scope.to_bytes().to_vec()), BaseKey::new(end.to_vec()))
}

fn prepend(scope_bytes: [u8; SCOPE_LEN], key: BaseKey) -> BaseKey {
    let key_bytes = key.into_vec();
    let mut bytes = Vec::with_capacity(SCOPE_LEN + key_bytes.len());
    bytes.extend_from_slice(&scope_bytes);
    bytes.extend_from_slice(&key_bytes);
    BaseKey::new(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_map_to_two_bytes_in_index_order() {
        assert_eq!(KeyScope::User(0).to_bytes(), [0, 0]);
        assert_eq!(KeyScope::User(1).to_bytes(), [0, 1]);
        assert_eq!(KeyScope::User(256).to_bytes(), [1, 0]);
        assert_eq!(KeyScope::User(MAX_USER_INDEX).to_bytes(), [0x7F, 0xFF]);
        assert_eq!(KeyScope::Canister.to_bytes(), [0xFF, 0xFF]);

        assert_eq!(KeyScope::User(1).end_bytes(), Some([0, 2]));
        assert_eq!(KeyScope::User(MAX_USER_INDEX).end_bytes(), Some([0x80, 0]));
        assert_eq!(KeyScope::Canister.end_bytes(), None);
    }

    #[test]
    #[should_panic(expected = "User index 32768 is out of range")]
    fn user_index_above_max_panics() {
        KeyScope::User(MAX_USER_INDEX + 1).to_bytes();
    }
}

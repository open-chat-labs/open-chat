use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{ApnsDevice, ApnsToken, UserId};

/// The iOS devices each user has registered for APNs pushes. The notifications index and every
/// local user index hold a copy and apply the same operations in the same order.
#[derive(Serialize, Deserialize, Default, Debug)]
pub struct ApnsDeviceStore {
    devices: BTreeMap<UserId, Vec<ApnsDevice>>,
}

impl ApnsDeviceStore {
    /// Registers `device` as one of the user's devices.
    ///
    /// A token identifies an app install, not an account, so the last user to register wins: any
    /// device, of this user or another, that holds either of the new device's tokens is replaced
    /// whole. Returns false, changing nothing, if the device holds no token or is already
    /// registered to this user exactly as it is.
    pub fn register(&mut self, user_id: UserId, device: ApnsDevice) -> bool {
        if device.is_empty() || self.get_for_user(&user_id).contains(&device) {
            return false;
        }

        self.devices.retain(|_, devices| {
            devices.retain(|d| !d.shares_a_token_with(&device));
            !devices.is_empty()
        });
        self.devices.entry(user_id).or_default().push(device);
        true
    }

    /// Removes the user's device that holds any of `device`'s tokens, with all of its tokens.
    /// Used on sign-out. Returns whether anything was removed.
    pub fn remove_device(&mut self, user_id: &UserId, device: &ApnsDevice) -> bool {
        self.update_user(user_id, |devices| devices.retain(|d| !d.shares_a_token_with(device)))
    }

    /// Removes one token that APNs rejected, keeping the rest of its device. A device left with
    /// no token goes. Returns whether anything was removed.
    pub fn remove_token(&mut self, user_id: &UserId, token: &ApnsToken) -> bool {
        self.update_user(user_id, |devices| {
            for device in devices.iter_mut() {
                if device.alert_token.as_ref() == Some(token) {
                    device.alert_token = None;
                }
                if device.voip_token.as_ref() == Some(token) {
                    device.voip_token = None;
                }
            }
            devices.retain(|d| !d.is_empty());
        })
    }

    pub fn get_for_user(&self, user_id: &UserId) -> &[ApnsDevice] {
        self.devices.get(user_id).map_or(&[], |d| d.as_slice())
    }

    pub fn has_any(&self, user_id: &UserId) -> bool {
        !self.get_for_user(user_id).is_empty()
    }

    /// Whether any of the user's devices can be rung through PushKit
    pub fn has_voip(&self, user_id: &UserId) -> bool {
        self.get_for_user(user_id).iter().any(|d| d.voip_token.is_some())
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &ApnsDevice)> {
        self.devices
            .iter()
            .flat_map(|(u, devices)| devices.iter().map(move |d| (u, d)))
    }

    pub fn len(&self) -> usize {
        self.devices.values().map(|d| d.len()).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.devices.is_empty()
    }

    fn update_user(&mut self, user_id: &UserId, f: impl FnOnce(&mut Vec<ApnsDevice>)) -> bool {
        let Some(devices) = self.devices.get_mut(user_id) else {
            return false;
        };
        let before = devices.clone();
        f(devices);
        let changed = *devices != before;
        if devices.is_empty() {
            self.devices.remove(user_id);
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::CanisterId;

    fn user(text: &str) -> UserId {
        UserId::new(CanisterId::from_text(text).unwrap())
    }

    fn alice() -> UserId {
        user("3skqk-iqaaa-aaaaf-aaa3q-cai")
    }

    fn bob() -> UserId {
        user("hnv5y-siaaa-aaaaf-aacza-cai")
    }

    fn device(alert: Option<&str>, voip: Option<&str>) -> ApnsDevice {
        ApnsDevice {
            alert_token: alert.map(|t| ApnsToken(t.to_string())),
            voip_token: voip.map(|t| ApnsToken(t.to_string())),
        }
    }

    // #10398 invariant 6
    #[test]
    fn invariant_6_registering_stores_both_tokens_as_one_device_and_another_user_takes_the_whole_device() {
        let mut store = ApnsDeviceStore::default();
        let phone = device(Some("alert1"), Some("voip1"));

        assert!(store.register(alice(), phone.clone()));
        assert_eq!(store.get_for_user(&alice()), std::slice::from_ref(&phone));
        // Registering again as it is changes nothing
        assert!(!store.register(alice(), phone.clone()));

        // Bob signs in on the same phone. Sharing only the VoIP token is enough to take it.
        let bobs = device(Some("alert2"), Some("voip1"));
        assert!(store.register(bob(), bobs.clone()));
        assert!(store.get_for_user(&alice()).is_empty());
        assert_eq!(store.get_for_user(&bob()), [bobs]);
        assert_eq!(store.len(), 1);

        // A device with no token is never stored
        assert!(!store.register(alice(), device(None, None)));
        assert!(!store.has_any(&alice()));
    }

    // #10398 invariant 6: the same user's device gets its tokens refreshed in place
    #[test]
    fn invariant_6_a_new_token_for_the_same_device_replaces_it() {
        let mut store = ApnsDeviceStore::default();
        store.register(alice(), device(Some("alert1"), None));
        store.register(alice(), device(Some("alert1"), Some("voip1")));
        assert_eq!(store.get_for_user(&alice()), [device(Some("alert1"), Some("voip1"))]);

        // A second phone is a second device
        store.register(alice(), device(Some("alert2"), None));
        assert_eq!(store.get_for_user(&alice()).len(), 2);
    }

    // #10398 invariant 7
    #[test]
    fn invariant_7_sign_out_removes_both_tokens_and_a_rejection_removes_only_the_rejected_one() {
        let mut store = ApnsDeviceStore::default();
        store.register(alice(), device(Some("alert1"), Some("voip1")));
        store.register(alice(), device(Some("alert2"), Some("voip2")));

        // APNs rejected one token: the device keeps its other one
        assert!(store.remove_token(&alice(), &ApnsToken("alert1".to_string())));
        assert_eq!(
            store.get_for_user(&alice()),
            [device(None, Some("voip1")), device(Some("alert2"), Some("voip2"))]
        );

        // Sign-out, naming only the alert token, removes the whole device
        assert!(store.remove_device(&alice(), &device(Some("alert2"), None)));
        assert_eq!(store.get_for_user(&alice()), [device(None, Some("voip1"))]);

        // Another user can't remove alice's device
        assert!(!store.remove_device(&bob(), &device(None, Some("voip1"))));
        // A device left with no token goes
        assert!(store.remove_token(&alice(), &ApnsToken("voip1".to_string())));
        assert!(store.is_empty());
    }
}

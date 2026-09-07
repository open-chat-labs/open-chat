use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::Hash;
use types::{AiAppId, Milliseconds, TimestampMillis};

const WINDOW: Milliseconds = 60 * 60 * 1000;
const MAX_FAILURES_PER_CALLER: usize = 10;
const MAX_CHAT_LINK_FAILURES_PER_APP_CALLER: usize = 1_000;
const CARD_ATTESTATION_WINDOW: Milliseconds = 60 * 1000;
const MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER: usize = 20;
const MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP: usize = 10;
const MAX_CARD_ATTESTATION_ATTEMPTS_PER_APP: usize = 200;
const MAX_CARD_ATTESTATION_ATTEMPTS_GLOBAL: usize = 1_000;
const MAX_CARD_ATTESTATION_IN_FLIGHT_PER_CALLER: usize = 4;
const MAX_CARD_ATTESTATION_IN_FLIGHT_PER_APP: usize = 32;
const MAX_CARD_ATTESTATION_IN_FLIGHT_GLOBAL: usize = 128;
const CARD_ATTESTATION_IN_FLIGHT_LEASE: Milliseconds = 30 * 1000;
const RECIPIENT_ROUTE_WINDOW: Milliseconds = 60 * 1000;
const MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_CALLER: usize = 200;
const MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_CALLER_APP: usize = 40;
const MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_APP: usize = 200;
const MAX_RECIPIENT_ROUTE_ATTEMPTS_GLOBAL: usize = 500;
const MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER: usize = 32;
const MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER_APP: usize = 4;
const MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_APP: usize = 32;
const MAX_RECIPIENT_ROUTE_IN_FLIGHT_GLOBAL: usize = 64;
const RECIPIENT_ROUTE_IN_FLIGHT_LEASE: Milliseconds = 30 * 1000;
const ACTION_DEPOSIT_WINDOW: Milliseconds = 60 * 1000;
const MAX_ACTION_DEPOSIT_ATTEMPTS_PER_CALLER: usize = 200;
const MAX_ACTION_DEPOSIT_ATTEMPTS_PER_CALLER_APP: usize = 100;
const MAX_ACTION_DEPOSIT_ATTEMPTS_PER_APP: usize = 500;
const MAX_ACTION_DEPOSIT_ATTEMPTS_GLOBAL: usize = 2_000;
const MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_CALLER: usize = 16;
const MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_APP: usize = 64;
const MAX_ACTION_DEPOSIT_IN_FLIGHT_GLOBAL: usize = 256;
const ACTION_DEPOSIT_IN_FLIGHT_LEASE: Milliseconds = 30 * 1000;
const MAX_TRACKED_CALLERS_PER_ENDPOINT: usize = 4_096;

/// Aggregate-only operational visibility for app-controlled card attestations. These metrics
/// deliberately contain no principals, app ids, card content, payload hashes, or remote errors.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct AiAppCardAttestationMetrics {
    pub attempts_in_window: usize,
    pub callers_in_window: usize,
    pub apps_in_window: usize,
    pub in_flight: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AiAppCallKind {
    Claim,
    CardRedeem,
    Revoke,
}

/// Failure throttle for the two external AI-app endpoints. Only failures count.
/// Claim and revoke have independent per-principal buckets, so distributed callers
/// cannot create a global lockout and one endpoint cannot deny the other. Each map
/// has a hard cap with deterministic oldest-bucket eviction.
#[derive(Serialize, Deserialize, Default)]
pub struct AiAppCallThrottle {
    #[serde(default)]
    claim_failures: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default)]
    card_redeem_failures: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default)]
    chat_link_redeem_failures: HashMap<(Principal, [u8; 32]), Vec<TimestampMillis>>,
    #[serde(default)]
    chat_link_redeem_failures_by_caller: HashMap<Principal, Vec<TimestampMillis>>,
    /// All full-card attestation attempts, recorded before the inter-canister await. Unlike the
    /// failure buckets, this also bounds concurrent calls and calls whose target rejects or traps.
    #[serde(default)]
    card_attestation_attempts: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default)]
    card_attestation_attempts_by_caller_app: HashMap<(Principal, AiAppId), Vec<TimestampMillis>>,
    #[serde(default)]
    card_attestation_attempts_by_app: HashMap<AiAppId, Vec<TimestampMillis>>,
    #[serde(default)]
    card_attestation_attempts_global: Vec<TimestampMillis>,
    /// Leased reservations are recorded before the third-party await. Completion removes one exact
    /// reservation; a callback lost to upgrade is pruned after a period longer than the 10s call
    /// timeout, so it cannot permanently consume capacity.
    #[serde(default)]
    card_attestation_in_flight: Vec<(Principal, AiAppId, TimestampMillis)>,
    /// App-authorized recipient selection is a distinct third-party await before deposit
    /// preparation. Its admission budget is separate so direct-chat retries cannot amplify one
    /// leased card into unbounded callbacks or starve card attestation/deposit capacity.
    #[serde(default)]
    recipient_route_attempts: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default)]
    recipient_route_attempts_by_caller_app: HashMap<(Principal, AiAppId), Vec<TimestampMillis>>,
    #[serde(default)]
    recipient_route_attempts_by_app: HashMap<AiAppId, Vec<TimestampMillis>>,
    #[serde(default)]
    recipient_route_attempts_global: Vec<TimestampMillis>,
    #[serde(default)]
    recipient_route_in_flight: Vec<(Principal, AiAppId, TimestampMillis)>,
    #[serde(default)]
    action_deposit_attempts: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default)]
    action_deposit_attempts_by_caller_app: HashMap<(Principal, AiAppId), Vec<TimestampMillis>>,
    #[serde(default)]
    action_deposit_attempts_by_app: HashMap<AiAppId, Vec<TimestampMillis>>,
    #[serde(default)]
    action_deposit_attempts_global: Vec<TimestampMillis>,
    #[serde(default)]
    action_deposit_in_flight: Vec<(Principal, AiAppId, TimestampMillis)>,
    #[serde(default)]
    revoke_failures: HashMap<Principal, Vec<TimestampMillis>>,
    // Upgrade compatibility with the pre-v2 shared/global throttle. Endpoint
    // provenance cannot be reconstructed, so legacy buckets are dropped on first
    // touch. The 256-bit claim token makes this one-time reset safe.
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    failures: HashMap<Principal, Vec<TimestampMillis>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    global: Vec<TimestampMillis>,
}

impl AiAppCallThrottle {
    pub fn card_attestation_metrics(&self, now: TimestampMillis) -> AiAppCardAttestationMetrics {
        let attempt_cutoff = now.saturating_sub(CARD_ATTESTATION_WINDOW);
        let in_flight_cutoff = now.saturating_sub(CARD_ATTESTATION_IN_FLIGHT_LEASE);
        AiAppCardAttestationMetrics {
            attempts_in_window: self
                .card_attestation_attempts_global
                .iter()
                .filter(|timestamp| **timestamp > attempt_cutoff)
                .count(),
            callers_in_window: self
                .card_attestation_attempts
                .values()
                .filter(|timestamps| timestamps.iter().any(|timestamp| *timestamp > attempt_cutoff))
                .count(),
            apps_in_window: self
                .card_attestation_attempts_by_app
                .values()
                .filter(|timestamps| timestamps.iter().any(|timestamp| *timestamp > attempt_cutoff))
                .count(),
            in_flight: self
                .card_attestation_in_flight
                .iter()
                .filter(|(_, _, started_at)| *started_at > in_flight_cutoff)
                .count(),
        }
    }

    pub fn admit_recipient_route(
        &mut self,
        caller: Principal,
        app_id: AiAppId,
        now: TimestampMillis,
    ) -> Result<(), Milliseconds> {
        self.clear_legacy();
        Self::prune_with_window(&mut self.recipient_route_attempts, now, RECIPIENT_ROUTE_WINDOW);
        Self::prune_with_window(&mut self.recipient_route_attempts_by_caller_app, now, RECIPIENT_ROUTE_WINDOW);
        Self::prune_with_window(&mut self.recipient_route_attempts_by_app, now, RECIPIENT_ROUTE_WINDOW);
        let cutoff = now.saturating_sub(RECIPIENT_ROUTE_WINDOW);
        self.recipient_route_attempts_global.retain(|timestamp| *timestamp > cutoff);
        let in_flight_cutoff = now.saturating_sub(RECIPIENT_ROUTE_IN_FLIGHT_LEASE);
        self.recipient_route_in_flight
            .retain(|(_, _, started_at)| *started_at > in_flight_cutoff);

        let caller_app = (caller, app_id);
        if self
            .recipient_route_attempts
            .get(&caller)
            .is_some_and(|attempts| attempts.len() >= MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_CALLER)
            || self
                .recipient_route_attempts_by_caller_app
                .get(&caller_app)
                .is_some_and(|attempts| attempts.len() >= MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_CALLER_APP)
            || self
                .recipient_route_attempts_by_app
                .get(&app_id)
                .is_some_and(|attempts| attempts.len() >= MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_APP)
            || self.recipient_route_attempts_global.len() >= MAX_RECIPIENT_ROUTE_ATTEMPTS_GLOBAL
        {
            return Err(RECIPIENT_ROUTE_WINDOW);
        }
        let in_flight_for_caller = self
            .recipient_route_in_flight
            .iter()
            .filter(|(candidate, _, _)| *candidate == caller)
            .count();
        let in_flight_for_caller_app = self
            .recipient_route_in_flight
            .iter()
            .filter(|(candidate, candidate_app, _)| *candidate == caller && *candidate_app == app_id)
            .count();
        let in_flight_for_app = self
            .recipient_route_in_flight
            .iter()
            .filter(|(_, candidate, _)| *candidate == app_id)
            .count();
        if in_flight_for_caller >= MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER
            || in_flight_for_caller_app >= MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER_APP
            || in_flight_for_app >= MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_APP
            || self.recipient_route_in_flight.len() >= MAX_RECIPIENT_ROUTE_IN_FLIGHT_GLOBAL
        {
            return Err(RECIPIENT_ROUTE_IN_FLIGHT_LEASE);
        }
        if !self.recipient_route_attempts.contains_key(&caller)
            && self.recipient_route_attempts.len() >= MAX_TRACKED_CALLERS_PER_ENDPOINT
        {
            return Err(RECIPIENT_ROUTE_WINDOW);
        }

        self.recipient_route_attempts.entry(caller).or_default().push(now);
        self.recipient_route_attempts_by_caller_app
            .entry(caller_app)
            .or_default()
            .push(now);
        self.recipient_route_attempts_by_app.entry(app_id).or_default().push(now);
        self.recipient_route_attempts_global.push(now);
        self.recipient_route_in_flight.push((caller, app_id, now));
        Ok(())
    }

    pub fn finish_recipient_route(&mut self, caller: Principal, app_id: AiAppId, started_at: TimestampMillis) {
        if let Some(position) = self
            .recipient_route_in_flight
            .iter()
            .position(|entry| *entry == (caller, app_id, started_at))
        {
            self.recipient_route_in_flight.swap_remove(position);
        }
    }

    pub fn admit_action_deposit(
        &mut self,
        caller: Principal,
        app_id: AiAppId,
        now: TimestampMillis,
    ) -> Result<(), Milliseconds> {
        self.clear_legacy();
        Self::prune_with_window(&mut self.action_deposit_attempts, now, ACTION_DEPOSIT_WINDOW);
        Self::prune_with_window(&mut self.action_deposit_attempts_by_caller_app, now, ACTION_DEPOSIT_WINDOW);
        Self::prune_with_window(&mut self.action_deposit_attempts_by_app, now, ACTION_DEPOSIT_WINDOW);
        let cutoff = now.saturating_sub(ACTION_DEPOSIT_WINDOW);
        self.action_deposit_attempts_global.retain(|timestamp| *timestamp > cutoff);
        let in_flight_cutoff = now.saturating_sub(ACTION_DEPOSIT_IN_FLIGHT_LEASE);
        self.action_deposit_in_flight
            .retain(|(_, _, started_at)| *started_at > in_flight_cutoff);

        if self
            .action_deposit_attempts
            .get(&caller)
            .is_some_and(|attempts| attempts.len() >= MAX_ACTION_DEPOSIT_ATTEMPTS_PER_CALLER)
            || self
                .action_deposit_attempts_by_caller_app
                .get(&(caller, app_id))
                .is_some_and(|attempts| attempts.len() >= MAX_ACTION_DEPOSIT_ATTEMPTS_PER_CALLER_APP)
            || self
                .action_deposit_attempts_by_app
                .get(&app_id)
                .is_some_and(|attempts| attempts.len() >= MAX_ACTION_DEPOSIT_ATTEMPTS_PER_APP)
            || self.action_deposit_attempts_global.len() >= MAX_ACTION_DEPOSIT_ATTEMPTS_GLOBAL
        {
            return Err(ACTION_DEPOSIT_WINDOW);
        }
        let in_flight_for_caller = self
            .action_deposit_in_flight
            .iter()
            .filter(|(candidate, _, _)| *candidate == caller)
            .count();
        let in_flight_for_app = self
            .action_deposit_in_flight
            .iter()
            .filter(|(_, candidate, _)| *candidate == app_id)
            .count();
        if in_flight_for_caller >= MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_CALLER
            || in_flight_for_app >= MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_APP
            || self.action_deposit_in_flight.len() >= MAX_ACTION_DEPOSIT_IN_FLIGHT_GLOBAL
        {
            return Err(ACTION_DEPOSIT_IN_FLIGHT_LEASE);
        }
        if !self.action_deposit_attempts.contains_key(&caller)
            && self.action_deposit_attempts.len() >= MAX_TRACKED_CALLERS_PER_ENDPOINT
        {
            return Err(ACTION_DEPOSIT_WINDOW);
        }
        self.action_deposit_attempts.entry(caller).or_default().push(now);
        self.action_deposit_attempts_by_caller_app
            .entry((caller, app_id))
            .or_default()
            .push(now);
        self.action_deposit_attempts_by_app.entry(app_id).or_default().push(now);
        self.action_deposit_attempts_global.push(now);
        self.action_deposit_in_flight.push((caller, app_id, now));
        Ok(())
    }

    pub fn finish_action_deposit(&mut self, caller: Principal, app_id: AiAppId, started_at: TimestampMillis) {
        if let Some(position) = self
            .action_deposit_in_flight
            .iter()
            .position(|entry| *entry == (caller, app_id, started_at))
        {
            self.action_deposit_in_flight.swap_remove(position);
        }
    }

    pub fn admit_card_attestation(
        &mut self,
        caller: Principal,
        app_id: AiAppId,
        now: TimestampMillis,
    ) -> Result<(), Milliseconds> {
        self.clear_legacy();
        Self::prune_with_window(&mut self.card_attestation_attempts, now, CARD_ATTESTATION_WINDOW);
        Self::prune_with_window(
            &mut self.card_attestation_attempts_by_caller_app,
            now,
            CARD_ATTESTATION_WINDOW,
        );
        Self::prune_with_window(&mut self.card_attestation_attempts_by_app, now, CARD_ATTESTATION_WINDOW);
        let cutoff = now.saturating_sub(CARD_ATTESTATION_WINDOW);
        self.card_attestation_attempts_global.retain(|timestamp| *timestamp > cutoff);
        let in_flight_cutoff = now.saturating_sub(CARD_ATTESTATION_IN_FLIGHT_LEASE);
        self.card_attestation_in_flight
            .retain(|(_, _, started_at)| *started_at > in_flight_cutoff);

        if let Some(attempts) = self.card_attestation_attempts.get(&caller)
            && attempts.len() >= MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER
        {
            return Err(Self::retry_after_with_window(attempts, now, CARD_ATTESTATION_WINDOW));
        }
        let caller_app = (caller, app_id);
        if let Some(attempts) = self.card_attestation_attempts_by_caller_app.get(&caller_app)
            && attempts.len() >= MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP
        {
            return Err(Self::retry_after_with_window(attempts, now, CARD_ATTESTATION_WINDOW));
        }
        if let Some(attempts) = self.card_attestation_attempts_by_app.get(&app_id)
            && attempts.len() >= MAX_CARD_ATTESTATION_ATTEMPTS_PER_APP
        {
            return Err(Self::retry_after_with_window(attempts, now, CARD_ATTESTATION_WINDOW));
        }
        if self.card_attestation_attempts_global.len() >= MAX_CARD_ATTESTATION_ATTEMPTS_GLOBAL {
            return Err(Self::retry_after_with_window(
                &self.card_attestation_attempts_global,
                now,
                CARD_ATTESTATION_WINDOW,
            ));
        }
        let in_flight_for_caller = self
            .card_attestation_in_flight
            .iter()
            .filter(|(candidate, _, _)| *candidate == caller)
            .count();
        let in_flight_for_app = self
            .card_attestation_in_flight
            .iter()
            .filter(|(_, candidate, _)| *candidate == app_id)
            .count();
        if in_flight_for_caller >= MAX_CARD_ATTESTATION_IN_FLIGHT_PER_CALLER
            || in_flight_for_app >= MAX_CARD_ATTESTATION_IN_FLIGHT_PER_APP
            || self.card_attestation_in_flight.len() >= MAX_CARD_ATTESTATION_IN_FLIGHT_GLOBAL
        {
            return Err(CARD_ATTESTATION_IN_FLIGHT_LEASE);
        }

        // Never evict a live caller bucket: eviction would let a distributed caller immediately
        // reset its own quota. The global cap guarantees this map naturally drains after one window.
        if !self.card_attestation_attempts.contains_key(&caller)
            && self.card_attestation_attempts.len() >= MAX_TRACKED_CALLERS_PER_ENDPOINT
        {
            return Err(CARD_ATTESTATION_WINDOW);
        }
        self.card_attestation_attempts.entry(caller).or_default().push(now);
        self.card_attestation_attempts_by_caller_app
            .entry(caller_app)
            .or_default()
            .push(now);
        self.card_attestation_attempts_by_app.entry(app_id).or_default().push(now);
        self.card_attestation_attempts_global.push(now);
        self.card_attestation_in_flight.push((caller, app_id, now));
        Ok(())
    }

    pub fn finish_card_attestation(&mut self, caller: Principal, app_id: AiAppId, started_at: TimestampMillis) {
        if let Some(position) = self
            .card_attestation_in_flight
            .iter()
            .position(|entry| *entry == (caller, app_id, started_at))
        {
            self.card_attestation_in_flight.swap_remove(position);
        }
    }

    pub fn check(&mut self, kind: AiAppCallKind, caller: Principal, now: TimestampMillis) -> Result<(), Milliseconds> {
        self.clear_legacy();
        let failures = self.failures_mut(kind);
        Self::prune(failures, now);
        if let Some(failures) = failures.get(&caller)
            && failures.len() >= MAX_FAILURES_PER_CALLER
        {
            return Err(Self::retry_after(failures, now));
        }
        Ok(())
    }

    pub fn record_failure(&mut self, kind: AiAppCallKind, caller: Principal, now: TimestampMillis) {
        self.clear_legacy();
        let failures = self.failures_mut(kind);
        Self::prune(failures, now);
        Self::make_room_for_caller(failures, caller);
        failures.entry(caller).or_default().push(now);
    }

    pub fn check_chat_link_redeem(
        &mut self,
        caller: Principal,
        app_subject: [u8; 32],
        now: TimestampMillis,
    ) -> Result<(), Milliseconds> {
        self.check_chat_link_redeem_caller(caller, now)?;
        Self::prune_with_window(&mut self.chat_link_redeem_failures, now, WINDOW);
        let key = (caller, app_subject);
        if let Some(failures) = self.chat_link_redeem_failures.get(&key)
            && failures.len() >= MAX_FAILURES_PER_CALLER
        {
            return Err(Self::retry_after(failures, now));
        }
        Ok(())
    }

    pub fn record_chat_link_redeem_failure(&mut self, caller: Principal, app_subject: [u8; 32], now: TimestampMillis) {
        self.record_chat_link_redeem_caller_failure(caller, now);
        Self::prune_with_window(&mut self.chat_link_redeem_failures, now, WINDOW);
        let key = (caller, app_subject);
        Self::make_room_for_subject(&mut self.chat_link_redeem_failures, key);
        self.chat_link_redeem_failures.entry(key).or_default().push(now);
    }

    pub fn check_chat_link_redeem_caller(&mut self, caller: Principal, now: TimestampMillis) -> Result<(), Milliseconds> {
        self.clear_legacy();
        Self::prune(&mut self.chat_link_redeem_failures_by_caller, now);
        if let Some(failures) = self.chat_link_redeem_failures_by_caller.get(&caller)
            && failures.len() >= MAX_CHAT_LINK_FAILURES_PER_APP_CALLER
        {
            return Err(Self::retry_after(failures, now));
        }
        Ok(())
    }

    pub fn record_chat_link_redeem_caller_failure(&mut self, caller: Principal, now: TimestampMillis) {
        self.clear_legacy();
        Self::prune(&mut self.chat_link_redeem_failures_by_caller, now);
        Self::make_room_for_caller(&mut self.chat_link_redeem_failures_by_caller, caller);
        self.chat_link_redeem_failures_by_caller.entry(caller).or_default().push(now);
    }

    fn failures_mut(&mut self, kind: AiAppCallKind) -> &mut HashMap<Principal, Vec<TimestampMillis>> {
        match kind {
            AiAppCallKind::Claim => &mut self.claim_failures,
            AiAppCallKind::CardRedeem => &mut self.card_redeem_failures,
            AiAppCallKind::Revoke => &mut self.revoke_failures,
        }
    }

    fn prune(failures: &mut HashMap<Principal, Vec<TimestampMillis>>, now: TimestampMillis) {
        Self::prune_with_window(failures, now, WINDOW);
    }

    fn make_room_for_subject(failures: &mut HashMap<(Principal, [u8; 32]), Vec<TimestampMillis>>, key: (Principal, [u8; 32])) {
        if !failures.contains_key(&key)
            && failures.len() >= MAX_TRACKED_CALLERS_PER_ENDPOINT
            && let Some(oldest) = failures
                .iter()
                .min_by(|((caller_a, subject_a), times_a), ((caller_b, subject_b), times_b)| {
                    times_a
                        .last()
                        .unwrap_or(&0)
                        .cmp(times_b.last().unwrap_or(&0))
                        .then_with(|| caller_a.as_slice().cmp(caller_b.as_slice()))
                        .then_with(|| subject_a.cmp(subject_b))
                })
                .map(|(key, _)| *key)
        {
            failures.remove(&oldest);
        }
    }

    fn prune_with_window<K: Eq + Hash>(
        timestamps_by_caller: &mut HashMap<K, Vec<TimestampMillis>>,
        now: TimestampMillis,
        window: Milliseconds,
    ) {
        let cutoff = now.saturating_sub(window);
        timestamps_by_caller.retain(|_, timestamps| {
            timestamps.retain(|timestamp| *timestamp > cutoff);
            !timestamps.is_empty()
        });
    }

    fn make_room_for_caller(timestamps_by_caller: &mut HashMap<Principal, Vec<TimestampMillis>>, caller: Principal) {
        if !timestamps_by_caller.contains_key(&caller)
            && timestamps_by_caller.len() >= MAX_TRACKED_CALLERS_PER_ENDPOINT
            && let Some(oldest) = timestamps_by_caller
                .iter()
                .min_by(|(principal_a, times_a), (principal_b, times_b)| {
                    times_a
                        .last()
                        .unwrap_or(&0)
                        .cmp(times_b.last().unwrap_or(&0))
                        .then_with(|| principal_a.as_slice().cmp(principal_b.as_slice()))
                })
                .map(|(principal, _)| *principal)
        {
            timestamps_by_caller.remove(&oldest);
        }
    }

    fn clear_legacy(&mut self) {
        self.failures.clear();
        self.global.clear();
    }

    fn retry_after(timestamps: &[TimestampMillis], now: TimestampMillis) -> Milliseconds {
        Self::retry_after_with_window(timestamps, now, WINDOW)
    }

    fn retry_after_with_window(timestamps: &[TimestampMillis], now: TimestampMillis, window: Milliseconds) -> Milliseconds {
        timestamps
            .iter()
            .min()
            .map_or(window, |oldest| (oldest + window).saturating_sub(now))
    }

    #[cfg(test)]
    fn tracked_callers(&self, kind: AiAppCallKind) -> usize {
        match kind {
            AiAppCallKind::Claim => self.claim_failures.len(),
            AiAppCallKind::CardRedeem => self.card_redeem_failures.len(),
            AiAppCallKind::Revoke => self.revoke_failures.len(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn principal(seed: u32) -> Principal {
        Principal::self_authenticating(seed.to_le_bytes())
    }

    #[test]
    fn indexed_user_quota_keys_do_not_share_the_host_canisters_allowance() {
        let host = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 42, 1, 1]);
        let first = types::UserId::new_indexed(host, 1);
        let second = types::UserId::new_indexed(host, 2);
        assert_eq!(first.canister_id(), second.canister_id());
        let mut throttle = AiAppCallThrottle::default();
        let now = 100_000;
        for _ in 0..MAX_CARD_ATTESTATION_IN_FLIGHT_PER_CALLER {
            assert!(throttle.admit_card_attestation(first.as_principal(), 7, now).is_ok());
        }
        assert!(throttle.admit_card_attestation(first.as_principal(), 7, now).is_err());
        assert!(throttle.admit_card_attestation(second.as_principal(), 7, now).is_ok());
        for _ in 0..MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER_APP {
            assert!(throttle.admit_recipient_route(first.as_principal(), 7, now).is_ok());
        }
        assert!(throttle.admit_recipient_route(first.as_principal(), 7, now).is_err());
        assert!(throttle.admit_recipient_route(second.as_principal(), 7, now).is_ok());
    }

    #[test]
    fn claim_and_revoke_buckets_are_independent() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(1);
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::Claim, caller, 1);
        }
        assert!(throttle.check(AiAppCallKind::Claim, caller, 1).is_err());
        assert!(throttle.check(AiAppCallKind::Revoke, caller, 1).is_ok());
        assert!(throttle.check(AiAppCallKind::CardRedeem, caller, 1).is_ok());
    }

    #[test]
    fn repeated_card_redeem_misses_are_bounded_and_recover_after_window() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(11);
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::CardRedeem, caller, 1);
        }
        assert!(throttle.check(AiAppCallKind::CardRedeem, caller, 1).is_err());
        assert!(throttle.check(AiAppCallKind::Claim, caller, 1).is_ok());
        assert!(throttle.check(AiAppCallKind::CardRedeem, caller, WINDOW + 2).is_ok());
    }

    #[test]
    fn chat_link_redeem_failures_are_scoped_to_exact_app_subject() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(11);
        let subject_a = [1; 32];
        let subject_b = [2; 32];
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_chat_link_redeem_failure(caller, subject_a, 1);
        }
        assert!(throttle.check_chat_link_redeem(caller, subject_a, 1).is_err());
        assert!(throttle.check_chat_link_redeem(caller, subject_b, 1).is_ok());
        assert!(throttle.check_chat_link_redeem(principal(12), subject_a, 1).is_ok());
        assert!(throttle.check_chat_link_redeem(caller, subject_a, WINDOW + 2).is_ok());
    }

    #[test]
    fn rotating_untrusted_subjects_cannot_evade_the_high_app_caller_ceiling() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(15);
        for seed in 0..MAX_CHAT_LINK_FAILURES_PER_APP_CALLER {
            let mut subject = [0; 32];
            subject[..8].copy_from_slice(&(seed as u64).to_be_bytes());
            throttle.record_chat_link_redeem_failure(caller, subject, 1);
        }
        assert!(throttle.check_chat_link_redeem(caller, [0xFE; 32], 1).is_err());
        assert!(throttle.check_chat_link_redeem(principal(16), [0xFE; 32], 1).is_ok());
    }

    #[test]
    fn rejected_or_trapped_card_attestation_spam_is_bounded_before_await() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(12);

        // Admission is permanently recorded for the short window even after the separate
        // in-flight reservation is released on success, reject, or timeout.
        for _ in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP {
            assert!(throttle.admit_card_attestation(caller, 1, 1).is_ok());
            throttle.finish_card_attestation(caller, 1, 1);
        }
        assert!(throttle.admit_card_attestation(caller, 1, 1).is_err());
        assert!(
            throttle
                .admit_card_attestation(caller, 1, CARD_ATTESTATION_WINDOW + 2)
                .is_ok()
        );
    }

    #[test]
    fn attestation_metrics_are_aggregate_and_honor_windows() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(101);
        assert!(throttle.admit_card_attestation(caller, 55, 10).is_ok());

        assert_eq!(
            throttle.card_attestation_metrics(10),
            AiAppCardAttestationMetrics {
                attempts_in_window: 1,
                callers_in_window: 1,
                apps_in_window: 1,
                in_flight: 1,
            }
        );
        throttle.finish_card_attestation(caller, 55, 10);
        assert_eq!(throttle.card_attestation_metrics(10).in_flight, 0);
        assert_eq!(
            throttle
                .card_attestation_metrics(CARD_ATTESTATION_WINDOW + 11)
                .attempts_in_window,
            0
        );
    }

    #[test]
    fn current_state_round_trip_preserves_attempts_and_in_flight_leases() {
        let caller = principal(91);
        let mut attempts = AiAppCallThrottle::default();
        for _ in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP {
            assert!(attempts.admit_card_attestation(caller, 1, 1).is_ok());
            attempts.finish_card_attestation(caller, 1, 1);
        }
        let encoded = msgpack::serialize_to_vec(&attempts).unwrap();
        let mut restored: AiAppCallThrottle = msgpack::deserialize_then_unwrap(&encoded);
        assert!(restored.admit_card_attestation(caller, 1, 1).is_err());
        assert!(
            restored
                .admit_card_attestation(caller, 1, CARD_ATTESTATION_WINDOW + 2)
                .is_ok()
        );

        let mut in_flight = AiAppCallThrottle::default();
        for _ in 0..MAX_CARD_ATTESTATION_IN_FLIGHT_PER_CALLER {
            assert!(in_flight.admit_card_attestation(caller, 2, 1).is_ok());
        }
        let encoded = msgpack::serialize_to_vec(&in_flight).unwrap();
        let mut restored: AiAppCallThrottle = msgpack::deserialize_then_unwrap(&encoded);
        assert!(restored.admit_card_attestation(caller, 3, 1).is_err());
        assert!(
            restored
                .admit_card_attestation(caller, 3, CARD_ATTESTATION_IN_FLIGHT_LEASE + 2)
                .is_ok()
        );
    }

    #[test]
    fn card_attestation_limit_is_per_caller() {
        let mut throttle = AiAppCallThrottle::default();
        let abusive = principal(13);
        let other = principal(14);
        for _ in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP {
            assert!(throttle.admit_card_attestation(abusive, 1, 1).is_ok());
            throttle.finish_card_attestation(abusive, 1, 1);
        }
        assert!(throttle.admit_card_attestation(abusive, 1, 1).is_err());
        assert!(throttle.admit_card_attestation(other, 1, 1).is_ok());
    }

    #[test]
    fn card_attestation_completed_attempt_limits_are_independent_at_every_scope() {
        let mut per_caller = AiAppCallThrottle::default();
        let caller = principal(20_001);
        for app_id in [1, 2] {
            for _ in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP {
                assert!(per_caller.admit_card_attestation(caller, app_id, 1).is_ok());
                per_caller.finish_card_attestation(caller, app_id, 1);
            }
        }
        assert_eq!(
            MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER,
            2 * MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP
        );
        assert!(per_caller.admit_card_attestation(caller, 3, 1).is_err());

        let mut per_app = AiAppCallThrottle::default();
        let app_id = 44;
        for seed in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_APP {
            let distributed_caller = principal(30_000 + seed as u32);
            assert!(per_app.admit_card_attestation(distributed_caller, app_id, 1).is_ok());
            per_app.finish_card_attestation(distributed_caller, app_id, 1);
        }
        assert!(per_app.admit_card_attestation(principal(39_999), app_id, 1).is_err());
        assert!(per_app.admit_card_attestation(principal(39_999), app_id + 1, 1).is_ok());

        let mut global = AiAppCallThrottle::default();
        for seed in 0..MAX_CARD_ATTESTATION_ATTEMPTS_GLOBAL {
            let distributed_caller = principal(40_000 + seed as u32);
            let distributed_app = 100 + (seed / MAX_CARD_ATTESTATION_ATTEMPTS_PER_APP) as AiAppId;
            assert!(global.admit_card_attestation(distributed_caller, distributed_app, 1).is_ok());
            global.finish_card_attestation(distributed_caller, distributed_app, 1);
        }
        assert!(global.admit_card_attestation(principal(49_999), 999, 1).is_err());
        assert!(
            global
                .admit_card_attestation(principal(49_999), 999, CARD_ATTESTATION_WINDOW + 2)
                .is_ok()
        );
    }

    #[test]
    fn app_and_in_flight_limits_prevent_distributed_amplification() {
        let mut throttle = AiAppCallThrottle::default();
        let app_id = 77;
        for seed in 0..MAX_CARD_ATTESTATION_IN_FLIGHT_PER_APP {
            assert!(throttle.admit_card_attestation(principal(seed as u32), app_id, 1).is_ok());
        }
        assert!(
            throttle.admit_card_attestation(principal(9_999), app_id, 1).is_err(),
            "a distributed caller set must not exceed one app's concurrent budget"
        );

        assert!(
            throttle
                .admit_card_attestation(principal(9_999), app_id, CARD_ATTESTATION_IN_FLIGHT_LEASE + 2)
                .is_ok(),
            "a callback lost to upgrade must not strand its reservation forever"
        );
    }

    #[test]
    fn action_deposit_admission_bounds_in_flight_work_per_caller_app_and_globally() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(77);
        for _ in 0..MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_CALLER {
            assert!(throttle.admit_action_deposit(caller, 1, 1).is_ok());
        }
        assert!(throttle.admit_action_deposit(caller, 2, 1).is_err());

        throttle.finish_action_deposit(caller, 1, 1);
        assert!(throttle.admit_action_deposit(caller, 2, 1).is_ok());

        let mut per_app = AiAppCallThrottle::default();
        for seed in 0..MAX_ACTION_DEPOSIT_IN_FLIGHT_PER_APP {
            assert!(per_app.admit_action_deposit(principal(seed as u32), 9, 1).is_ok());
        }
        assert!(per_app.admit_action_deposit(principal(9_999), 9, 1).is_err());
        assert!(
            per_app
                .admit_action_deposit(principal(9_999), 9, ACTION_DEPOSIT_IN_FLIGHT_LEASE + 2)
                .is_ok()
        );
    }

    #[test]
    fn rejected_action_deposit_attempts_remain_rate_limited_after_in_flight_release() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(78);
        for _ in 0..MAX_ACTION_DEPOSIT_ATTEMPTS_PER_CALLER_APP {
            assert!(throttle.admit_action_deposit(caller, 3, 1).is_ok());
            throttle.finish_action_deposit(caller, 3, 1);
        }
        assert!(throttle.admit_action_deposit(caller, 3, 1).is_err());
        assert!(throttle.admit_action_deposit(caller, 3, ACTION_DEPOSIT_WINDOW + 2).is_ok());
    }

    #[test]
    fn recipient_route_admission_bounds_concurrent_hanging_callbacks_and_exact_retries() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(79);
        let app_id = 4;
        for _ in 0..MAX_RECIPIENT_ROUTE_IN_FLIGHT_PER_CALLER_APP {
            assert!(throttle.admit_recipient_route(caller, app_id, 1).is_ok());
        }
        assert!(
            throttle.admit_recipient_route(caller, app_id, 1).is_err(),
            "one direct-chat card must not amplify into unbounded app callbacks"
        );
        assert!(
            throttle.admit_recipient_route(principal(80), app_id, 1).is_ok(),
            "one user must not consume another user's recipient-route budget on the same LUI"
        );

        throttle.finish_recipient_route(caller, app_id, 1);
        assert!(throttle.admit_recipient_route(caller, app_id, 1).is_ok());

        let mut rate_limited = AiAppCallThrottle::default();
        for _ in 0..MAX_RECIPIENT_ROUTE_ATTEMPTS_PER_CALLER_APP {
            assert!(rate_limited.admit_recipient_route(caller, app_id, 1).is_ok());
            rate_limited.finish_recipient_route(caller, app_id, 1);
        }
        assert!(rate_limited.admit_recipient_route(caller, app_id, 1).is_err());
        assert!(
            rate_limited
                .admit_recipient_route(caller, app_id, RECIPIENT_ROUTE_WINDOW + 2)
                .is_ok(),
            "the bounded rate window must recover"
        );
    }

    #[test]
    fn caller_app_limit_does_not_block_an_unrelated_app() {
        let mut throttle = AiAppCallThrottle::default();
        let caller = principal(88);
        for _ in 0..MAX_CARD_ATTESTATION_ATTEMPTS_PER_CALLER_APP {
            assert!(throttle.admit_card_attestation(caller, 1, 1).is_ok());
            throttle.finish_card_attestation(caller, 1, 1);
        }
        assert!(throttle.admit_card_attestation(caller, 1, 1).is_err());
        assert!(throttle.admit_card_attestation(caller, 2, 1).is_ok());
    }

    #[test]
    fn distributed_callers_do_not_create_a_global_lockout() {
        let mut throttle = AiAppCallThrottle::default();
        for seed in 0..2_000 {
            throttle.record_failure(AiAppCallKind::Claim, principal(seed), 1);
        }
        assert!(throttle.check(AiAppCallKind::Claim, principal(9_999), 1).is_ok());
    }

    #[test]
    fn anonymous_claim_and_revoke_misses_are_bounded_because_apps_must_be_canisters() {
        let mut throttle = AiAppCallThrottle::default();
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::Claim, Principal::anonymous(), 1);
        }
        assert!(throttle.check(AiAppCallKind::Claim, Principal::anonymous(), 1).is_err());
        assert_eq!(throttle.tracked_callers(AiAppCallKind::Claim), 1);

        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::Revoke, Principal::anonymous(), 1);
        }
        assert!(throttle.check(AiAppCallKind::Revoke, Principal::anonymous(), 1).is_err());
    }

    #[test]
    fn anonymous_card_redemption_misses_have_a_bounded_admission_bucket() {
        let mut throttle = AiAppCallThrottle::default();
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::CardRedeem, Principal::anonymous(), 1);
        }
        assert!(throttle.check(AiAppCallKind::CardRedeem, Principal::anonymous(), 1).is_err());
        assert_eq!(throttle.tracked_callers(AiAppCallKind::CardRedeem), 1);
        assert!(
            throttle
                .check(AiAppCallKind::CardRedeem, Principal::anonymous(), WINDOW + 2)
                .is_ok()
        );
    }

    #[test]
    fn tracked_caller_memory_is_bounded_and_recovers_after_the_window() {
        let mut throttle = AiAppCallThrottle::default();
        for seed in 0..(MAX_TRACKED_CALLERS_PER_ENDPOINT as u32 + 50) {
            throttle.record_failure(AiAppCallKind::Claim, principal(seed), 1);
        }
        assert!(throttle.tracked_callers(AiAppCallKind::Claim) <= MAX_TRACKED_CALLERS_PER_ENDPOINT);

        let caller = principal(42_424);
        for _ in 0..MAX_FAILURES_PER_CALLER {
            throttle.record_failure(AiAppCallKind::Revoke, caller, 1);
        }
        assert!(throttle.check(AiAppCallKind::Revoke, caller, 1).is_err());
        assert!(throttle.check(AiAppCallKind::Revoke, caller, WINDOW + 2).is_ok());
    }

    #[test]
    fn legacy_shared_throttle_state_deserializes_and_is_discarded_on_first_touch() {
        #[derive(Serialize)]
        struct Legacy {
            failures: HashMap<Principal, Vec<TimestampMillis>>,
            global: Vec<TimestampMillis>,
        }

        let caller = principal(7);
        let bytes = msgpack::serialize_to_vec(&Legacy {
            failures: HashMap::from([(caller, vec![1; MAX_FAILURES_PER_CALLER])]),
            global: vec![1; MAX_FAILURES_PER_CALLER],
        })
        .unwrap();
        let mut restored: AiAppCallThrottle = msgpack::deserialize_then_unwrap(&bytes);
        assert!(restored.check(AiAppCallKind::Claim, caller, 1).is_ok());
        assert!(restored.check(AiAppCallKind::Revoke, caller, 1).is_ok());
        assert!(restored.failures.is_empty());
        assert!(restored.global.is_empty());
    }
}

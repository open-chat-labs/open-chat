use crate::StreakInsuranceMetrics;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{StreakInsuranceClaim, StreakInsurancePayment};

#[derive(Serialize, Deserialize, Default)]
pub struct StreakInsuranceLogs {
    payment: Vec<StreakInsurancePayment>,
    claims: Vec<StreakInsuranceClaim>,
}

impl StreakInsuranceLogs {
    pub fn mark_payment(&mut self, payment: StreakInsurancePayment) {
        self.payment.push(payment)
    }

    pub fn mark_claim(&mut self, claim: StreakInsuranceClaim) {
        self.claims.push(claim)
    }

    pub fn metrics(&self) -> StreakInsuranceMetrics {
        let mut metrics = StreakInsuranceMetrics {
            payments: self.payment.len() as u32,
            claims: self.claims.len() as u32,
            ..Default::default()
        };
        let mut payment_users = HashSet::new();
        for payment in self.payment.iter() {
            metrics.total_paid += payment.chat_amount;
            if payment_users.insert(payment.user_id) {
                metrics.payments_unique_users += 1;
            }
        }
        let mut claim_users = HashSet::new();
        for claim in self.claims.iter() {
            if claim_users.insert(claim.user_id) {
                metrics.claims_unique_users += 1;
            }
        }
        metrics
    }
}

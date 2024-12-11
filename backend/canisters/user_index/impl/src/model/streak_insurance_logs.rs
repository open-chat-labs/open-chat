use serde::{Deserialize, Serialize};
use types::{StreakInsuranceClaim, StreakInsurancePayment};

#[derive(Serialize, Deserialize, Default)]
pub struct StreakInsuranceLogs {
    payment_history: Vec<StreakInsurancePayment>,
    claims: Vec<StreakInsuranceClaim>,
}

impl StreakInsuranceLogs {
    pub fn mark_payment(&mut self, payment: StreakInsurancePayment) {
        self.payment_history.push(payment)
    }

    pub fn mark_claim(&mut self, claim: StreakInsuranceClaim) {
        self.claims.push(claim)
    }
}

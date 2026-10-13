use candid::Nat;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;

pub struct MetadataHelper {
    name: String,
    symbol: String,
    decimals: u8,
    fee: u128,
    burn_fee: u128,
    logo: Option<String>,
    is_icrc1_compatible: bool,
}

impl MetadataHelper {
    pub fn try_parse(metadata: Vec<(String, MetadataValue)>) -> Result<MetadataHelper, String> {
        let mut name = None;
        let mut symbol = None;
        let mut decimals = None;
        let mut fee = None;
        let mut burn_fee = 0;
        let mut logo = None;
        let mut is_icrc1_compatible = true;

        for (key, value) in metadata {
            match (key.as_str(), value) {
                ("icrc1:name", MetadataValue::Text(s)) => name = Some(s),
                ("icrc1:symbol", MetadataValue::Text(s)) => symbol = Some(s),
                ("icrc1:decimals", MetadataValue::Nat(n)) => decimals = u8::try_from(n.0).ok(),
                ("icrc1:fee", MetadataValue::Nat(n)) => fee = u128::try_from(n.0).ok(),
                ("icrc1:logo", MetadataValue::Text(s)) => logo = Some(s),
                // A burn fee too large to fit is saturated, so the balance never covers it
                ("icrc1:burn_fee", MetadataValue::Nat(n)) => burn_fee = u128::try_from(n.0).unwrap_or(u128::MAX),
                ("icrc1:burn_fee_rate" | "icrc1:transfer_fee_rate", MetadataValue::Nat(n)) if n > Nat::default() => {
                    is_icrc1_compatible = false
                }
                _ => {}
            }
        }
        if burn_fee > 0 {
            is_icrc1_compatible = false;
        }

        match (name, symbol, decimals, fee) {
            (Some(n), Some(s), Some(d), Some(f)) => Ok(MetadataHelper {
                name: n,
                symbol: s,
                decimals: d,
                fee: f,
                burn_fee,
                logo,
                is_icrc1_compatible,
            }),
            (None, ..) => Err("Name not found".to_string()),
            (_, None, ..) => Err("Symbol not found".to_string()),
            (.., None, _) => Err("Decimals not found".to_string()),
            (.., None) => Err("Fee not found".to_string()),
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    pub fn decimals(&self) -> u8 {
        self.decimals
    }

    pub fn fee(&self) -> u128 {
        self.fee
    }

    pub fn burn_fee(&self) -> u128 {
        self.burn_fee
    }

    pub fn logo(&self) -> Option<&String> {
        self.logo.as_ref()
    }

    pub fn is_icrc1_compatible(&self) -> bool {
        self.is_icrc1_compatible
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata(extra: Vec<(&str, u128)>) -> Vec<(String, MetadataValue)> {
        let mut metadata = vec![
            ("icrc1:name".to_string(), MetadataValue::Text("FOREST".to_string())),
            ("icrc1:symbol".to_string(), MetadataValue::Text("FOREST".to_string())),
            ("icrc1:decimals".to_string(), MetadataValue::Nat(8u32.into())),
            ("icrc1:fee".to_string(), MetadataValue::Nat(0u32.into())),
        ];
        metadata.extend(extra.into_iter().map(|(k, v)| (k.to_string(), MetadataValue::Nat(v.into()))));
        metadata
    }

    #[test]
    fn burn_fee_is_recorded_and_makes_the_token_incompatible() {
        let helper = MetadataHelper::try_parse(metadata(vec![
            ("icrc1:burn_fee", 10_000_000),
            ("icrc1:transfer_fee_rate", 0),
            ("icrc1:burn_fee_rate", 0),
        ]))
        .unwrap();

        assert_eq!(helper.burn_fee(), 10_000_000);
        assert!(!helper.is_icrc1_compatible());
    }

    #[test]
    fn zero_burn_fee_is_compatible() {
        let helper = MetadataHelper::try_parse(metadata(vec![("icrc1:burn_fee", 0)])).unwrap();

        assert_eq!(helper.burn_fee(), 0);
        assert!(helper.is_icrc1_compatible());
    }

    #[test]
    fn no_burn_fee_is_zero() {
        let helper = MetadataHelper::try_parse(metadata(Vec::new())).unwrap();

        assert_eq!(helper.burn_fee(), 0);
        assert!(helper.is_icrc1_compatible());
    }
}

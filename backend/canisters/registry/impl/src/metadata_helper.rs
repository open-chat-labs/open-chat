use candid::Nat;
use icrc_ledger_types::icrc::generic_metadata_value::MetadataValue;

pub struct MetadataHelper {
    name: String,
    symbol: String,
    decimals: u8,
    fee: u128,
    logo: Option<String>,
    is_icrc1_compatible: bool,
}

impl MetadataHelper {
    pub fn try_parse(metadata: Vec<(String, MetadataValue)>) -> Result<MetadataHelper, String> {
        let mut name = None;
        let mut symbol = None;
        let mut decimals = None;
        let mut fee = None;
        let mut logo = None;
        let mut is_icrc1_compatible = true;

        for (key, value) in metadata {
            match (key.as_str(), value) {
                ("icrc1:name", MetadataValue::Text(s)) => name = Some(s),
                ("icrc1:symbol", MetadataValue::Text(s)) => symbol = Some(s),
                ("icrc1:decimals", MetadataValue::Nat(n)) => decimals = u8::try_from(n.0).ok(),
                ("icrc1:fee", MetadataValue::Nat(n)) => fee = u128::try_from(n.0).ok(),
                ("icrc1:logo", MetadataValue::Text(s)) => logo = Some(s),
                ("icrc1:burn_fee" | "icrc1:burn_fee_rate" | "icrc1:transfer_fee_rate", MetadataValue::Nat(n))
                    if n > Nat::default() =>
                {
                    is_icrc1_compatible = false
                }
                _ => {}
            }
        }

        match (name, symbol, decimals, fee) {
            (Some(n), Some(s), Some(d), Some(f)) => Ok(MetadataHelper {
                name: n,
                symbol: s,
                decimals: d,
                fee: f,
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

    pub fn logo(&self) -> Option<&String> {
        self.logo.as_ref()
    }

    pub fn is_icrc1_compatible(&self) -> bool {
        self.is_icrc1_compatible
    }
}

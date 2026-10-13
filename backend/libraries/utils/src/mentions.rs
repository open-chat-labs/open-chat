use candid::Principal;
use types::UserId;

// How a user is mentioned in text, eg. `@UserId(rrkah-fqaaa-aaaaa-aaaaq-cai)`, as the website writes
// and reads them
pub const MENTION_PREFIX: &str = "@UserId(";

// Passes the id of each user mentioned in `text` through `f`, replacing it with the id returned.
// Returns the updated text if any were replaced, otherwise None.
pub fn replace_mentioned_users(text: &str, mut f: impl FnMut(UserId) -> UserId) -> Option<String> {
    if !text.contains(MENTION_PREFIX) {
        return None;
    }
    let mut updated = String::with_capacity(text.len());
    let mut rest = text;
    let mut changed = false;
    while let Some(index) = rest.find(MENTION_PREFIX) {
        let start = index + MENTION_PREFIX.len();
        updated.push_str(&rest[..start]);
        rest = &rest[start..];
        if let Some(len) = rest.find(')')
            && let Ok(principal) = Principal::from_text(&rest[..len])
        {
            let user_id = UserId::from(principal);
            let new_user_id = f(user_id);
            if new_user_id != user_id {
                updated.push_str(&new_user_id.to_string());
                rest = &rest[len..];
                changed = true;
            }
        }
    }
    if changed {
        updated.push_str(rest);
        Some(updated)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u1() -> UserId {
        Principal::from_text("4bkt6-4aaaa-aaaaf-aaaiq-cai").unwrap().into()
    }

    fn u2() -> UserId {
        Principal::from_text("2fzwl-cu3hl-bawo2-idwrw-7yygk-uccms-cbo3a-c6kqt-lnk3j-mewg3-hae")
            .unwrap()
            .into()
    }

    fn u3() -> UserId {
        Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap().into()
    }

    // Replaces u1 with u3, recording each id it is given
    fn replace(text: &str) -> (Option<String>, Vec<UserId>) {
        let mut seen = Vec::new();
        let result = replace_mentioned_users(text, |u| {
            seen.push(u);
            if u == u1() { u3() } else { u }
        });
        (result, seen)
    }

    #[test]
    fn text_without_mentions_is_unchanged() {
        for text in [
            "",
            "abc 123",
            "123 @UserId(xyz)",
            &u1().to_string(),
            &format!("UserId({})", u1()),
            &format!("@UserId({}_)", u1()),
            &format!("@UserId({}", u1()),
            "@UserId(",
        ] {
            assert_eq!(replace(text), (None, Vec::new()), "{text}");
        }
    }

    #[test]
    fn mentions_are_replaced() {
        let (u1, u2, u3) = (u1(), u2(), u3());

        assert_eq!(replace(&format!("@UserId({u1})")), (Some(format!("@UserId({u3})")), vec![u1]));
        assert_eq!(
            replace(&format!("123@UserId({u1})___@UserId({u2})___&&&!!!")),
            (Some(format!("123@UserId({u3})___@UserId({u2})___&&&!!!")), vec![u1, u2])
        );
        // Adjacent, and with text which isn't ASCII around them
        assert_eq!(
            replace(&format!("你好@UserId({u2})@UserId({u1})ü")),
            (Some(format!("你好@UserId({u2})@UserId({u3})ü")), vec![u2, u1])
        );
        // Nested in something which isn't itself a mention
        assert_eq!(
            replace(&format!("@UserId(@UserId({u1}))")),
            (Some(format!("@UserId(@UserId({u3}))")), vec![u1])
        );
        // A principal in upper case is the same principal
        assert_eq!(
            replace(&format!("@UserId({})", u1.to_string().to_uppercase())),
            (Some(format!("@UserId({u3})")), vec![u1])
        );
    }

    #[test]
    fn mentions_of_users_whose_ids_are_unchanged_are_left_as_they_are() {
        let (u2, u3) = (u2(), u3());

        assert_eq!(replace(&format!("@UserId({u2}) and @UserId({u3})")), (None, vec![u2, u3]));
    }
}

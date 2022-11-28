use crate::query::*;

type Milliseconds = u64;

pub struct Field {
    value: String,
    weight: f32,
}

#[derive(Default)]
pub struct Document {
    fields: Vec<Field>,
    age: Option<Milliseconds>,
}

impl Document {
    pub fn add_field(&mut self, value: String, weight: f32) -> &mut Document {
        self.fields.push(Field { value, weight });
        self
    }

    pub fn set_age(&mut self, age: Milliseconds) -> &mut Document {
        self.age = Some(age);
        self
    }

    // The search term is split into words and each word is matched against each field
    // There is a match if at least one word matches at least one field case insensitive
    // Extra weight is given:
    // 1. for matching all words
    // 2. for matching all fields
    // 3. for case-sensitive matches
    // 4. the shorter the matching field(s)
    // 5. if the word matches the start of the field
    // A score of zero means no match
    pub fn calculate_score(&self, query: &Query) -> u32 {
        (self.calculate_score_internal(query) * 10000.0) as u32
    }

    pub fn calculate_score_internal(&self, query: &Query) -> f32 {
        let mut score = 0.0;

        for field in &self.fields {
            score += score_field(query, field);
        }

        if score > 0.0 {
            if let Some(age) = self.age {
                score * calculate_age_boost(age)
            } else {
                score
            }
        } else {
            0.0
        }
    }
}

fn score_field(query: &Query, field: &Field) -> f32 {
    if query.tokens.is_empty() {
        return 0.0;
    }

    let mut total = 0.0;

    for token in &query.tokens {
        total += score_field_for_token(token, &field.value);
    }

    // Average of token matches
    let score = total / (query.tokens.len() as f32);

    if score > 0.0 {
        score * calculate_length_boost(field.value.len() as f32) * field.weight
    } else {
        0.0
    }
}

fn score_field_for_token(token: &Token, field: &str) -> f32 {
    let field_lower = field.to_lowercase();
    if field.starts_with(&token.value) {
        5.0
    } else if field_lower.starts_with(&token.value_lower) {
        3.0
    } else if field.contains(&token.value) {
        2.0
    } else if field_lower.contains(&token.value_lower) {
        1.0
    } else {
        0.0
    }
}

fn calculate_length_boost(x: f32) -> f32 {
    1.0 + (-x / 20.0).exp()
}

fn calculate_age_boost(age: Milliseconds) -> f32 {
    let age_in_days = (age / (1000 * 60 * 60 * 24)) as f32;
    1.0 + (-age_in_days / 20.0).exp()
}

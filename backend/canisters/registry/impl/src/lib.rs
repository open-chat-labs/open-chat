use crate::model::tokens::Tokens;
use candid::Principal;
use canister_state_macros::canister_state;
use registry_canister::{NervousSystem, TokenDetails};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod guards;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            tokens: self.data.tokens.get_all().to_vec(),
            canister_ids: CanisterIds {
                sns_wasm: self.data.sns_wasm_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    governance_principals: HashSet<Principal>,
    sns_wasm_canister_id: CanisterId,
    cycles_dispenser_canister_id: CanisterId,
    tokens: Tokens,
    test_mode: bool,
}

impl Data {
    pub fn new(
        governance_principals: HashSet<Principal>,
        sns_wasm_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals,
            sns_wasm_canister_id,
            cycles_dispenser_canister_id,
            tokens: Tokens::default(),
            test_mode,
        }
    }

    pub fn add_icp_token_details(
        &mut self,
        ledger: CanisterId,
        root: CanisterId,
        governance: CanisterId,
        now: TimestampMillis,
    ) {
        self.tokens.add(
            ledger,
            "Internet Computer".to_string(),
            "ICP".to_string(),
            8,
            10_000,
            Some("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAAXNSR0IArs4c6QAAAIRlWElmTU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAFCgAwAEAAAAAQAAAFAAAAAAwtohTAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KGV7hBwAAGZRJREFUeAHtW3l8XVWdP+fc5e1Z29LGLum+BEolnSKbpKBgUUQoibTgCAzQ0QEdEBxAtA+xLCIwH0WxVVFkGUxaLCBYoZhowUrbFFpIN7oTSumS5SVvvfeeM9/ffe+lL8lLaWlh5o934OYu7yy/8z2//ZwyVigFBAoIFBAoIFBAoIBAAYECAgUECggUECggUECggEABgQICBQQKCBQQKCDwCSKgFGd0hcPCvTM8/z8rijHuXmEmlEo/g8T/IzqVEtUL1xg1jY16GrD+aNXWK43qsLAS/X/9ZL4ogLXmumpD1TIt34guoDU1OtWpH6BOvna5345qBWrCAOxsxppmzrRzOxn34jsePeELarZlGAZLvHnx6I7c3wnI5uuqHca5zP3+cT27gO2v4bypqRed6srKkv1R5vXqpt1px6IjGlrjuTSo2lqNVe3nPNzk4Dvw/fByRAASNzXUosMMAJOX7BzGbX4ueOuzkNaT8L0C4xVhOB1XEtdeiMk6IfifNa984a0vjWonUjJA2qh/RMRRm6MpxHFNTTViZga42OXjhjuSf1Ex9TnQWoUZDEF/HlwOJt6F7+9jUm8Lg6+wlfNK2e+376bxwujnbIZ+wr0XgH7rWz4EQMWrFzK9eR63qOHEP+ycKYS4Ho9fEIEiP+dQebbFlIOFlg6kmTCGxOo6E7oJehWT0Ug77k9oyvhJS12FS2BNo9KbZvJe3NGXsKN9VxBDvqjZpbPjsjHTmRA3g5KLQqbwUl+Wo5iNZZMujdyVaV3D3QAEuHfZKiV0/jLT1MPBX2xeRm2oT7ao2UaNARd8YABJd81HQ3DLxMXbpwqpPSB8gc8xTWcy3g1KJAGAjl124rAi6At/02PRC4krKNR0zV/EnK72FH66/0Q2Yn5DHXeqFyojuzBE7EctxHWsBUQ0MOdA7YRPGaZzv8nFHK/OWbclQSaziTjQBTzxdKgornHFda6UhmXXuR7wQVWiVrdSr0qdf6f4xy2rqDrpxzr0f6jpoafcDnu+kq5rCqf13OSG3XdwTb+Le3zMiXUR6xMwJKp52/Z0cuiBVs8C7aYWKmVOZ9s28O2VLXWjXsW0QC7KR9SNKlyjQ1+5nNwxZ+w8zvl/F4HjIinABjHFNTCd4DqA53IfsSOByXTu4M4ApE4TTXJ+T+BH628nEnPHovds6QdCFjyysB/sH/esVlx2gRM5iAVUpLtovfq1Ub0WNtt13zsZEGVz02vSL8pK3LHx0pEL6JnG6muY6PvhSkttlVnV0JLacWWltzylPRny6Jd0p0iNsBRWzEDbfnT29NcfPEANQPGdxBl3C9BDcAwRT8omX9B/Ab9pZTwfiL0GcY0FxGt4/bu+EGevaaGST8tIGxkFEyBxKQSTAIsuYitqLLDYGpQf7oDWNQ7EVb36xXtOId2nNK2onDudB5du3PDobGht6RqYedNdHZZTOe9jFrzOK8aOAzEvFXm00ZGkQ23JXUlzdb6WRDrYH2BBtWBCmuAuj6ZBS3NjD5DQSTpP+UKGJ5GSG+NKnFZ2a3NnXxAPTZScYEyExoXYvq4HimdYsUjC1nUvuI7plsU8iQSuJDMsm6hUUtechM+noj6vkfB4XVr0ZIK6oMkMLD5oSzyohcpMO9K+TmP8nJa6EW1V9S1mS11VijoYqChwHgfnRa6YcBYU3Et+nXtjtkqiQ7Ku+QqJDOyHErohNFxMgngH2EH32VwDLRoHvwHUHvDQAtRnODLpC+meZEqu93QWVZPKIL3Lw64qcyeZHnTKfLQKE3hPgTtmxBKRpNdxvOW732PB7a3Mt2Mf87R2MnMvANznWLpiRqDMp4vhXhar9LLuySMPvDuhMrG3uHi4HigxnG5yBRUBSeLUt2AsbjpdbSktUHQydOu6qUtaT1s/e3hr9RoYl+lpq9+3UcbSpiJzxl0ID/45TINFbWWhs/zgwfBCFvSQRxgKdbuk6pZMdaCdB7xaHvTDIgK0uI2vAmNq3MCVCx7pSeLApLfYmJo0uxpA08W5dKF2xj+D+FQ9vfMaWT7kV6rjQOqELdvNksb1zFi+D9yGRRpkML1Ik7pHSL/u0x0ZV1i8pWanXOxtXbd2Aluy9wTG4jcv3jUOAv1tgHcNXB0uo3AQIA0YKG80gHop4Q2aMhE9IJWcsbmuckc+TsxyXtfc8Zd4NLYkKeEiEUBpTs+dEz1LjOeEDGF0AxypsXq4NY9putUcCFmR9qhpal7PEEPn06TglwCk2f6AbsQs6YAXSbwFAelyYJYrdZbyFJtmMu7c4L1m1cNqIdymec1YPLKEUG+n/uqtE9oGl28LRaKBTz3bKD1LdghVAReq3GTkKumOcgxHaX4stuPElmiOvP3n28Nb+lKefZ/09LYJXDPuFb7QxcpKgheTZInzcCOtIUD0+E2ZjB8QKlXdUjd2d65OzOq8yOXjv+QV7PkEfDr8BysLAexXFAwo1+D/MVjjl4Wmbgo9vu3tftVyPsRvnVaJyS0IBPW5SfQtNbLGWHDixiyQGj4bQkD8k47Bx/mveL1V1ddqPOvUjn7+g0VDI4lrh/3g8ZTYljKdaX6mpSQBx3TJ0AY+JxZHcPvffrn5B4/S+OGasL6naw+vaK5w5rP50DUYsL5eVLfXiqyPN6Vh90UQkEVaoGSI7O4gEAfSjeBEgJiI7bGUMW1r3bD9DNZZ3TyT82Zmtc8d/1lg8jdyhHHlBQ+jpzwaN10QGPtmyVNbHyE6KdatrggpNh8hGq0XlTDjzXuq3QWYnnHA4wumzYVIP6mB6xyBaEUjGAlELBW+4TllFhumlXAeM+f+80rVWENfUV5Xo6e/teGdkT95VuMdtpInmFyLO+gLig70gqsFgce5M2vh5u8vu676OmNLqEI1NYVdH8zto88fsuj7BzNOEce4J94p0k3zCb2o7EK7q4NcLPyf8QF72hEp4EQfxDnetXljt5zGrhrtWqTInIpJivvXGYKbloQ7lV9sUxBZsyvl7IWpnVX61DtvDhQT9wyZeSBOYu3bBYlk/P5TzsFkXyHgQCE4CAEpwUxAAhCASiKORXQmei9btcU1+VO3bb925CvrNLEplsoFD4aCrIz0CxOuinM1gXfDuJ96FjUvsg4HHtFF0QaBR0Zh6xXjI5vqRn3Z7moLa74AyFHk77gWPzMH3PAF7hKinJQIlEz8dFC8Qh/ULFYkRWkjggTTlq5RIg7uW1JwoM1uy1mvuDUlDR5Za3BRJi7u2yD3ndc1OATejnCl13fL2r9yXfyrGcAwuoDyR02XC12dSCJoGaWwNaZxLfUB+6DEsBVrL9WXbmPO1KCmxWyX89LgccsvvLqUyYZH3vn+b6+rXmj8bOu3yC884uJaVHAjceSm2lF3wuLOA5eRUSGW6wOi263Jox0pGSo/nT2z53dJkzUUm3xo3NHJvcmjQ5kLXpcl/xGaMKK65Knd7VmDc8REZiqODu9MkHEwr1/zOCxvvSeEaJmcagCYEWHGDRgYhIjgztlrUFd8/hv1pwVXvzveruBKS0qhgycz4CmDKUM6Cegb+1Yao725NN+EP5xOcGNDHZPEjeDERTIevVb44aq7pX+KS8LF4V1tNvP4v/6Xc587L9X2tq2Ez3R5tPdoafBS8rWiJ7ee4fpoyO+Rn9i72lG8lY5x54h46bZUiqwyICNdluFCcKSwoEcMQ4w++QTzX0TR8nfOM6LgTEPYSBNwAo+WGX6WHUAiA4xc/8iW8HbivgZWBzA/auGKuJFclI21I37tRDtvgJsDGYFVyMhvtmeaARDQp8Yi9kUjP+P8fcZvdF/kDZjBErdqBvkUIi2zMyXfCFlbz6a2bpRwBCJLdQcqJM6ui3L16u0AbrERAhquw+2KMJohglGIpuAO4PksoTQxjWJ5A/OAwXDBI+dch2hrCjpUsT/QYBUhpM6OQ6FIg1yUTXWVDwPE2/VQKWmZXguTlW2Aq0+14trnp1yg1p30Y+aPrAGIZYBc2n4d4FnOLqtbO5t0nSLOyyQWjpnMCbDYKEqohowFhniCqszKZZUPvNtTEN2qSg25PE0i1EEjAg+YS6SE8DkZg5Zc4xLUlFdfuT8d7Z/medU2uU/QiffISPuDCOlo6F5iR7SmQClYlI2xbX7htDlsx9ibma97taOb5XrMtqJIrc0c/NzmLjdCOUbO6zWHmhpXjE3dWG0jCqFUF9jukPpSQMWBolFsDCw2GwQLS6C5Dhru4DquPKiDDM+e07ZM2Eudk5/Xa5BjeuGqqQZcF1ZiQ93I79jdbU+FispNExmf3EFISOIwN6Wg7yDu3zj1m2rf0K9pnvhqFvNOubDk8c07XIOR8eOOiaTcxneGM2/te2FE9kC94Z0ch2yBywuZgYQMEhDVwYJElRMHkuiCCyHOJggGmO11Gb0HDZBtfXzu6cyN29emS0devioeeXGTL6gH4CTnyjOR3gXDdwryt42m3/nFOWH2ftnXvj3s0Rca62980HdMBmOgmcwHECi8roVSY539pk5QII7ELSTIKXOBA8IEHslS+j39TB19bCXMZWO40U25tz7w+5dv7OpizeDDEqTIckEkJdkBEKutJH/AU8xGnH//l0Eqr3vopnhtfT39/EmXNDdBCZII74e+A+cpAJkGzwD3kQGBUSmpZ/DSUcCux51IVRU2Z4ZnJvacetd5Q1YceOjfH62Xn4/HxSrsqYQgBYeUDulmxqLI4E1JRu1T/cFzJ9XvfoYIaqirlUjDEaMev3JnmudUfRVcJ1XSb+oEBqXDIBwktgcRZ5DoZjgRIFJqlAyLUp/aMbEKSRbG7mR3HlcZbgF4vCWc2jfmlvGe96LPxib72aDlreqnf1zGRiEtcxDmzdcHRCIAhkWPRNpSRlHZVyY17P6lq5soFZcnU/6REZ0fTjcNFA+D6homkdEBCx2aP6mfNFsdpBh3BxkMRMWIeQk8lwvJhXFCmsdvOLza7a0GlY5TUUhCVAG89spwiW7rf/VpptfpStrxycXaiPoW0fByk9qpwbRBEij/n4f3kUs8aOmhsnmTGnbdzeCo1zQ1YUo5kzwWWpua3Lk6tpihBzQPbUxhoXLnjzQ8JbHYDqFL9QaJbBY8RB+uLwi7LU1wMtybOqJlWBcW4ziUNUhEcCQhiAMRIv49KDzDE8pKQSR00W2x+OQyduKileKlf7yu3jJNbHJQYiQfiFxHQtbWg6W3TarfdSvtqVQvbKZpHDudW7rcPqDVvprprvca0jrBv5JMvCGE5qzgEnso2NyDPszoQVeMdctJUC7wqwvHhEfOa55nZfXhR8WROG86EhGKhcXQruSKYuE9qVsmydK5G020pCJqs9jEMn7G/cvlH9/aoL0VCGlQRC6IfcalSWp2d4ejB0vumdyw6z+bkRSGkw6t9NE50c3xIbGQePaMieh/tg16UGhhMgXuCk9qMlHGXmVXNwonWrRSSes9LxekD9MAQvfgmbI4FiZpIMS7221dVeVKfraro7mTwSDOU+Nu8LSNTK0sEd4ZnTJxCLwsebjzpEz5xg/Tz7+j4U8sFX+EFZchDlC9HO1sdegobkc7pQgUPzR58e4bCUQobE7Ji6OhL1u3GWktetYkuw/iS4+0LZHhamS3mVcKc5d4M3n+tnNTV70uHmq9KY4zBEv9wkMwO+DEtDijFcRZTzoxp0h4L39ybPiyOuit31aGXbeDej7S4oKHtnvH3jykLRV4o1iYMzoAHtqnOa93R5Zf6WabE2vtHsznsIsrvsk725azYCnq5gORdjvglkUjUviKHoRhuZ/BPaJ0GsXdvbs+/Jt6cZZnOrgvtfSMeXpQu8iO0pELV6PRCPgvBIKXO93m9ewbzheWkO51kb13zA9P0gVfD4eaLLEbkeCeBhKiDirgL8JyK3H27B3hv9eDm1hLi1PHGnLdtX7UQVSJ9bE/EZYHht92KtTwC0FulkdVqh/nuY2xx2Fi4yypnLie0E4q2fejbe53RCyTq3Y3C3/xNBnrBPBIUIKePoVOUThaEHYp0taoe7xz3r7ohA+QIddqBte6id0+9XteKbPcDL1H4NlLz7wQW03P2emYCIOk1YHDgszDN6m4OonfYv9Y/lybMoFdzLfxMPRSGKL10NjwH0LCV5eScQvgQWzTFpmMCt4dbGMhsiPXRl52wc4FboKBDEI1MtOsCYvD5mMwDukJ8/lksZvoLZ2xPjjitpt0Lh6gZG4Sh2kgdpS36FOUg0yRRt8lV6eX77pnpWIwOPULJa00ZbUNr2ctNqDGUtIV1QBin0KumWIWUmWUmMXhIXnDpktHPUa13K2LvzUxNb8Gi+7yDWeLkNJH4oDPbHIVnfPcmdfBe1ooaV8ErhQWRMAbdhHwsOUsxi5M3e192FzQ7f8Nu3TwNQzxPCfDQJz003F3jdWVswWGBOGdhAKhzYuMRQYBEG0HVlkLwPGxZfJxnVt3nLn9vt19ptDrdc+I7073cO3BUuE7q13G8Vv+vQz6LgAe5Spjjj1rSOu9y8hKk6tDHWb3bcbVvz8Y467VfMHhaRB5Pk6kJhaOoxjCG2DI+DQJxf8L+87uORf6sW9JLq6ZJDTrXj1oQGwBnoIGBHgc3ovBdqH6TrZN/lB+n80V/+MEYreL98bdPXv6+2FkrNylWIhcH1nZX48Nf7dY+O6LO/GkwaTH5UI0z9GLEs+qVHi1BHQYAF5icPmMbqk3Ta93nzfRadl6cbHpxE8Ft13l49pFlFHsVtiRcy0ZWLBvgdiirg4OxZkM9eWy3Quez+rM3KrZ/eKq+h1D4YStEv7gCIBI2fG8e8Lkg2M0B9lvw/WSnNTStxV7UA0auRptvKydDYMzXG3L0y4FX1xEBsOJJnASKwYP7wPQuQ/VRrL31Wz2F/lFdpWcnGKhUnNW9IN5f549elF217BnQuB9jMfV70f/YFmp5j8/IaNJbCZ5csAjUQaYrla1wKlGCRkevCdkHOLH2vAtCRksLRNmAM8sIhPULe2E0Vr0KjQwfrRMrmO3FLGvkLPKd967TGExORazV+XMS5boSc+04lyIek0LFk3EBj64lDhxwELaTPMEinlHKsnOsNr2zNE2mifyNwdVBrejUSsZIOgggXgjpCfUUNbBKtkuNZH9U05g96vhbD8zktVFQY+IHHh6dW3lHIq/G+rSyeWeiWVCNTVCia8ckLE3YXknppwEQGQZTkyDl+ZKZcCoqLhM2MTsJgDycm0wKTbK88QdRBU0H/jh+cDLTDUZ4B4PDEoMdT4H8Fa6nNc8zxXbTJ1et7Sfh5MLl/CDOL/z6VB350s4RXGmg9AOFYm03Ggh25ZOwqhUtNMKAsjlRlnFU/Is7FLMYOd0JK0JPMaLIQSwQHonTOhuMOefiamxocGQaJ7CUsnxQa+nI9K2agPAo04bNmzATNOlhwPptREGZSYMyvMTwoOwcfJ6qfCMiUsSZ2a6I6BOj15EFxkw6RsyOZz2UMiPpD7zTYSGoAKDo5wy4TcOyvhWnWvnlez60Y5cnZeuNvDfrE6kGvD9fqcFy76OqIReyRgQWXkLzRpzcUAvcvKcH0T4s8clNwuDYkNB3hDIhg+aEDoglQyVe5KdbWvLGD9zZd0IZH9wWhdGLTtAtmX2vQfEVyfeF0oko8sG6b7Tu+0oxckQU+yloGY6Xk6D6YLogpl2e/p12NMzhQfcQgRpwjlnbTLWsDfkvYIMxeHEtqd5n4fciUxa/O710Pk/E6aHYWOeXCSE9oddRBc2cs3IVc6uNoQJpzFxaAp7z1BoBribgbv/dKIa/hUCLXv0L5eUvPPNciJVXDH6ew8EmXmTB3KQhGgSYOA0uErpDHYm+eAue97OwJVoArq4ViJ8ok3GY+jqW3BTfkP9k6+YdXfo/agK0lg17GxBh0Grnm49GXr0Mb247GSnuxN87hxOrHuGIeIyhRw+mzDFgSfh4BQudPRtmy4dcS/9ng88+p5/zvgh695QpVWjvnc69NwDJdzzGeJAWGD4g8zGzLHvScfoeskBarjc5h5HFrCwRTA2UeyJp5T9hFd4bwnuDO9Vbp6xCkSHKVd0TCVroamTyfXv3gJbeAf2WYpwwgHKwgYotIhuCpzUIZ3Wo5kTYPREDjhmIHS4R0ymz/G8iPOOt+AU7YZ0rnE+o+iG+u9bBgSQKpIJba6e5yYA6H3jyNu+hOTCf4D7zh3EfRBn1IAFtWE4HFBF1JBjhMN22BIg+4FMskzEkT37I87jPTB4191rqR9FGRkkFej5eJXcU64Tnt8zCH4WTojJq+HGVMAnzByGx5BIxbuEIbai7+5vyH3CEkcA5AsQ359v/uqo14iu9Dlu0quYwQDlsABm2zRCzGrYfDr15Ha0o/LWSp/i5xqKnwk4qlBvGK4QLlIpOOyo9qFjnIjiLyspXhzUuuA9fAfAYdIAbmhH7x9Dwb8qWIN/VZA+6UonbYu4Og+sMwuDnwI+q8CYFMuTDemEsnsPOZT1mNQKmdL+tmVuxQGXJneboJZRBPRhNB4RgJlOOIDUatgUsH7vDfZ3h9/oK0Y+RHg8mqXMZOnOcK9/aJMGrgXtDh87fxixR/w7YufqYc1aFshsOwJ0kGF74m1JZ/O7E6N9xZKs++D9TOVa2Wzb43on/UhxMHFmRiD69a9YvVsH4GWNXL86H/sHqGIChS5XLfcdEED3/I7nvj9/Uu8k17gUDwMsug8E6idF0ADjwGxACHKvASoWPhcQKCBQQKCAQAGBAgIFBAoIFBAoIFBAoIBAAYECAgUECggUECggUECggMDHgMD/AjQbdSB4OFHHAAAAAElFTkSuQmCC".to_string()),
            Some(NervousSystem {
                is_nns: true,
                root,
                governance,
            }),
            Some("https://dashboard.internetcomputer.org/transactions".to_string()),
            Some("https://www.finder.com/uk/how-to-buy-internet-computer".to_string()),
            Some("https://dashboard.internetcomputer.org/transaction/{transaction_hash}".to_string()),
            now,
        );
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub tokens: Vec<TokenDetails>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub sns_wasm: CanisterId,
    pub cycles_dispenser: CanisterId,
}

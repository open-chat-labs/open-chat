/** For various reasons, we need to (attempt to) figure out roughly where the user is
 */
import { Poller } from "./poller";

const GET_COUNTRY_ATTEMPT_INTERVAL = 10_000; // 10 seconds

export async function getUserCountryCode(): Promise<string> {
    return new Promise<string>((resolve, _) => {
        const poller = new Poller(
            () =>
                getUserCountryCodeInner()
                    .then((country) => {
                        poller.stop();
                        resolve(country);
                    })
                    .catch((err) =>
                        console.warn("GEO: Unable to determine user's country location", err),
                    ),
            GET_COUNTRY_ATTEMPT_INTERVAL,
            GET_COUNTRY_ATTEMPT_INTERVAL,
            true,
        );
    });
}

function getUserCountryCodeInner(): Promise<string> {
    const BASE_URL = "https://api.iplocation.net";

    return fetch(`${BASE_URL}/?cmd=get-ip`)
        .then((resp) => {
            if (!resp.ok) {
                console.debug("GEO: error getting ip from ip location");
                throw new Error("Failed to fetch ip from IP Location");
            }
            return resp.json();
        })
        .then(({ ip }) => fetch(`${BASE_URL}/?ip=${ip}`))
        .then((resp) => {
            if (!resp.ok) {
                console.debug("GEO: error getting location from ip location");
                throw new Error("Failed to fetch user location from IP Location");
            }
            return resp.json();
        })
        .then((json) => {
            const country = json.country_code2;
            console.debug("GEO: derived user's location: ", country);
            return country;
        });
}

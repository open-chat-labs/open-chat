/** For various reasons, we need to (attempt to) figure out roughly where the user is
 */

const MAX_RETRIES = 5;

function primaryApi(): Promise<string> {
    return fetch("https://api.ip.sb/geoip")
        .then((resp) => {
            if (!resp.ok) {
                console.debug("GEO: error getting ip from ip location");
                throw new Error(
                    `Failed to get location data from the preferred service: ${resp.status}, ${resp.statusText}`,
                );
            }
            return resp.json();
        })
        .then((json) => json.country_code);
}

function secondaryApi(): Promise<string> {
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
        .then((json) => json.country_code2);
}

export function getUserCountryCode(retries: number = 0, delay: number = 50): Promise<string> {
    return primaryApi().catch((primaryErr) => {
        return secondaryApi().catch((secondaryErr) => {
            // this means that *both* apis have failed
            if (retries >= MAX_RETRIES) {
                throw new Error(
                    `Unable to determine the user's country code: ${primaryErr}, ${secondaryErr}`,
                );
            }

            return new Promise((resolve) => {
                setTimeout(() => {
                    getUserCountryCode(retries + 1, delay * 2).then(resolve);
                }, delay);
            });
        });
    });
}

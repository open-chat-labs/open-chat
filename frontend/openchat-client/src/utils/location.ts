/** For various reasons, we need to (attempt to) figure out roughly where the user is
 */

export function getUserCountryCode(): Promise<string> {
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

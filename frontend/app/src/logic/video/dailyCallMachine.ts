import pin from "../../../daily-call-machine.json";

/**
 * Where a Daily call object loads its bundles from (its call machine, and the audio processor when
 * it needs one): our own origin, the pinned copies that fetch-daily-call-machine.mjs puts in
 * public/daily/<version>/ (#10124). Never Daily's servers, and never through eval: the CSP allows
 * neither.
 */
export function dailyBundlePath(origin: string = location.origin): string {
    return `${origin}/daily/${pin.version}`;
}

export const DAILY_CALL_MACHINE_VERSION: string = pin.version;

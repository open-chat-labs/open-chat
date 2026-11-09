import type { LearnDoc } from "@openchat/ui/src/pages/learnContent";

// /csea-reporting: the moderators' manual NCA report checklist (#9239), as a Learn doc page whose
// head is the page's introduction; the checklist itself follows it (CseaChecklistScreen). In
// English only, as the old desktop page (components/landingpages/CseaReportingPage.svelte), whose
// words these are.

const TITLE = "Manual NCA report checklist";

// what everyone but a platform moderator or operator sees
const RESTRICTED: string[] = [
    "This page is a procedural checklist for OpenChat platform moderators filing reports with the National Crime Agency. If you believe you are seeing this in error, make sure you are signed in to your moderator account in this browser.",
    "If you have encountered child sexual abuse material on OpenChat, please report the message in the app, or report directly to the police, the NCA ([nca.gov.uk](https://www.nca.gov.uk)), or the Internet Watch Foundation ([report.iwf.org.uk](https://report.iwf.org.uk)).",
];

const INTRO: string[] = [
    "Filing a report on the NCA's Child Sexual Exploitation and Abuse Industry Reporting Portal (CSEA-IRP) by hand. Work top to bottom — progress is saved in this browser. Report **as soon as reasonably practicable — same day wherever possible**; the report never waits for an internal verdict on the material.",
];

/**
 * The page's doc: the checklist's introduction for a platform moderator or operator, and for
 * anyone else where to report material instead.
 */
export function cseaDoc(authorized: boolean): LearnDoc {
    return {
        kicker: "Moderation",
        title: TITLE,
        intro: authorized ? INTRO : RESTRICTED,
        sections: [],
    };
}

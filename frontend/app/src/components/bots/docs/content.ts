export type Section = {
    title: string;
    text: string;
    sections: Section[];
};

export const content: Section = {
    title: "Overview",
    text: `## Overview

    We are excited to launch phase one of our OpenChat bot api. Bots will greatly accelerate the extension and integration of OpenChat and we can't wait to see what you create.
    `,
    sections: [
        {
            title: "How does it work?",
            text: `## How does it work?
            
            In phase one, you can think of a bot as a piece of server software that will receive a command from a user (and optionally receive some parameters) via the OpenChat front end.  The bot will then have the opportunity to carry out whatever actions it wants before responding to the OpenChat frontend. It may also wish to interact with OpenChat's bot api to perform actions within OpenChat e.g. send a message to a chat etc.

            As an example, suppose we have a token price bot. The user may issue a command such as <code >/price icp</code >. The relevant bot will receive the command, look up the current price via some third party service, then use the OpenChat bot api to post a message to the relevant chat with the requested token price.

            A bot can be implemented either as an off-chain server using the technology of your choice <em>or</em> as an Internet Computer canister, whichever best suits the characteristics of your particular bot.
            `,
            sections: [],
        },
    ],
};

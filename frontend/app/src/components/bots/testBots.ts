import { type ExternalBot } from "openchat-shared";
// let's create some imaginary bots

export const bots: ExternalBot[] = [
    {
        name: "Kitten Bot",
        icon: "https://images.unsplash.com/photo-1529778873920-4da4926a72c2?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8NXx8fGVufDB8fHx8fA%3D%3D",
        id: "bot_one",
        endpoint: "https://some_bot_or_other",
        description: "this is just a test bot that doesn't do anything at all",
        commands: [
            {
                name: "kill",
                description: "kill everyone",
                params: [
                    {
                        kind: "string",
                        name: "reason",
                        required: false,
                        minLength: 1,
                        maxLength: 100,
                        description: "Why do you want to kill everyone?",
                    },
                ],
            },
            {
                name: "kick_poll",
                description: "Create a poll to kick someone out of the chat",
                params: [
                    {
                        kind: "user",
                        name: "user",
                        required: true,
                        description: "User to ban",
                    },
                    {
                        kind: "string",
                        name: "reason",
                        required: false,
                        minLength: 1,
                        maxLength: 100,
                        description: "Describe why we wan to ban this user",
                    },
                ],
            },
        ],
    },
    {
        name: "Puppy Bot",
        icon: "https://t3.ftcdn.net/jpg/02/74/06/48/360_F_274064877_Tuq84kGOn5nhyIJeUFTUSvXaSeedAOTT.jpg",
        id: "bot_two",
        endpoint: "https://some_bot_or_other",
        description: "And this is another bot",
        commands: [
            {
                name: "ban",
                description: "ban a person from this chat",
                params: [
                    {
                        kind: "user",
                        name: "user",
                        required: true,
                        description: "User to ban",
                    },
                ],
            },
        ],
    },
];

// this will be moved into the client at some point and we
// would have to figure out how they are registered but I
// don't want to deal with that at the moment
export function getBots() {
    return Promise.resolve(bots);
}

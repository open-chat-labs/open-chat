import { type ExternalBot } from "openchat-shared";
// let's create some imaginary bots

export const bots: ExternalBot[] = [
    {
        kind: "external_bot",
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
                        name: "Reason",
                        required: false,
                        minLength: 1,
                        maxLength: 100,
                        description: "Why do you want to kill everyone?",
                        placeholder: "Reason",
                        choices: [],
                    },
                ],
            },
            {
                name: "kick_poll",
                description: "Create a poll to kick someone out of the chat",
                params: [
                    {
                        kind: "user",
                        name: "User",
                        required: true,
                        description: "Please enter the user that you would like to ban.",
                        placeholder: "User to ban",
                        errorMessage: "You must enter the user that you want to ban",
                    },
                    {
                        kind: "string",
                        name: "Reason",
                        required: false,
                        minLength: 1,
                        maxLength: 100,
                        description: "Describe why you want to ban this user",
                        placeholder: "Reason",
                        choices: [],
                    },
                ],
            },
        ],
    },
    {
        kind: "external_bot",
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
                        name: "User",
                        required: true,
                        description: "Please enter the user that you would like to ban.",
                        placeholder: "User to ban",
                        errorMessage: "You must enter the user that you want to ban",
                    },
                ],
            },
            {
                name: "weather",
                description: "Show me the weather for tomorrow",
                params: [
                    {
                        kind: "string",
                        name: "City",
                        minLength: 0,
                        maxLength: 100,
                        required: true,
                        description: "Please select the city for requested forecast",
                        placeholder: "Select city",
                        choices: [
                            { kind: "option", name: "London", value: "london" },
                            { kind: "option", name: "Paris", value: "paris" },
                            { kind: "option", name: "Rome", value: "rome" },
                            { kind: "option", name: "New York", value: "new_york" },
                        ],
                        errorMessage: "You must select the city for the weather forecast",
                    },
                ],
            },
        ],
    },
    {
        kind: "external_bot",
        name: "Built in",
        icon: "http://f3nhr-bmaaa-aaaaa-qaayq-cai.localhost:8080/avatar/337552968497928491234552079353700799635",
        id: "bot_three",
        endpoint: "https://some_bot_or_other",
        description: "This is a built in bot",
        commands: [
            {
                name: "witch",
                description: "Summon the witch",
                params: [],
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

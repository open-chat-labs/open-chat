import { type Bot } from "openchat-shared";
import { emptyPermissions } from "./builtinBotCommands";

// these are just some pretend bots
export const testBots: Bot[] = [
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
                permissions: emptyPermissions,
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
                permissions: emptyPermissions,
                params: [
                    {
                        kind: "user",
                        name: "User",
                        required: true,
                        description: "Please enter the user that you would like to ban.",
                        placeholder: "User to ban",
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
        endpoint: "http://localhost:3000/execute",
        description: "And this is another bot",
        commands: [
            {
                name: "chat",
                description: "Ask OpenChat AI a question",
                permissions: {
                    ...emptyPermissions,
                    messagePermissions: ["text"],
                    threadPermissions: ["text"],
                },
                params: [
                    {
                        kind: "string",
                        name: "Prompt",
                        required: true,
                        minLength: 0,
                        maxLength: 1000,
                        description: "The text prompt to use for your AI query",
                        placeholder: "Enter prompt",
                        choices: [],
                    },
                ],
            },
            {
                name: "ban",
                description: "ban a person from this chat",
                permissions: emptyPermissions,
                params: [
                    {
                        kind: "user",
                        name: "User",
                        required: true,
                        description: "Please enter the user that you would like to ban.",
                        placeholder: "User to ban",
                    },
                ],
            },
            {
                name: "weather",
                description: "Show me the weather for tomorrow",
                permissions: emptyPermissions,
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
                    },
                ],
            },
            {
                name: "multiply",
                description: "Multiply some number I pick",
                permissions: emptyPermissions,
                params: [
                    {
                        kind: "number",
                        name: "Number",
                        minValue: 0,
                        maxValue: 100,
                        required: true,
                        description: "Please select a number from the list",
                        placeholder: "Select number",
                        choices: [
                            { kind: "option", name: "One", value: 1 },
                            { kind: "option", name: "Ten", value: 10 },
                            { kind: "option", name: "Twenty", value: 20 },
                            { kind: "option", name: "Forty five", value: 45 },
                        ],
                    },
                ],
            },
            {
                name: "calculate",
                description: "Do some calculations on two numbers",
                permissions: emptyPermissions,
                params: [
                    {
                        kind: "number",
                        name: "Number one",
                        minValue: 0,
                        maxValue: Number.MAX_VALUE,
                        required: true,
                        description: "Enter the first number",
                        placeholder: "First number",
                        choices: [],
                    },
                    {
                        kind: "number",
                        name: "Number two",
                        minValue: 0,
                        maxValue: Number.MAX_VALUE,
                        required: true,
                        description: "Enter the second number",
                        placeholder: "Second number",
                        choices: [],
                    },
                ],
            },
        ],
    },
];

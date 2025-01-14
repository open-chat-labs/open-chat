import { type Bot, type BotMatch, type SlashCommandSchema } from "openchat-shared";
import { emptyPermissions } from "./builtinBotCommands";

const killCommand: SlashCommandSchema = {
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
};

const kickPollCommand: SlashCommandSchema = {
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
};

const pingPong: SlashCommandSchema = {
    name: "ping_pong",
    description: "This will just take a message and send it back to you",
    permissions: {
        ...emptyPermissions,
        messagePermissions: ["text"],
    },
    params: [
        {
            kind: "string",
            name: "Prompt",
            required: true,
            minLength: 0,
            maxLength: 1000,
            description: "The text that you want to relay",
            placeholder: "Enter text",
            choices: [],
        },
    ],
};

const chatCommand: SlashCommandSchema = {
    name: "chat",
    description: "Ask OpenChat AI a question",
    permissions: {
        ...emptyPermissions,
        chatPermissions: ["reactToMessages", "pinMessages", "startVideoCall"],
        messagePermissions: ["text", "image", "file"],
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
};

const banCommand: SlashCommandSchema = {
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
};

const weatherCommand: SlashCommandSchema = {
    name: "weather",
    description: "Show me the weather for tomorrow",
    permissions: {
        ...emptyPermissions,
        messagePermissions: ["text", "giphy"],
    },
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
                { name: "London", value: "london" },
                { name: "Paris", value: "paris" },
                { name: "Rome", value: "rome" },
                { name: "New York", value: "new_york" },
            ],
        },
    ],
};

const multiplyCommand: SlashCommandSchema = {
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
                { name: "One", value: 1 },
                { name: "Ten", value: 10 },
                { name: "Twenty", value: 20 },
                { name: "Forty five", value: 45 },
            ],
        },
    ],
};

const calculateCommand: SlashCommandSchema = {
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
};

// these are just some pretend bots
export const testBots: Bot[] = [
    {
        kind: "external_bot",
        name: "Kitten Bot",
        avatarUrl:
            "https://images.unsplash.com/photo-1529778873920-4da4926a72c2?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxleHBsb3JlLWZlZWR8NXx8fGVufDB8fHx8fA%3D%3D",
        id: "bot_one",
        ownerId: "",
        endpoint: "https://some_bot_or_other",
        definition: {
            kind: "bot_definition",
            description: "this is just a test bot that doesn't do anything at all",
            commands: [killCommand, kickPollCommand],
        },
    },
    {
        kind: "external_bot",
        name: "Puppy Bot",
        avatarUrl:
            "https://t3.ftcdn.net/jpg/02/74/06/48/360_F_274064877_Tuq84kGOn5nhyIJeUFTUSvXaSeedAOTT.jpg",
        id: "bot_two",
        ownerId: "",
        endpoint: "http://localhost:3000/execute",
        definition: {
            kind: "bot_definition",
            description:
                "This bot also does not do anything but in this case it has a much longer description. The reason that we need a longer description is so that we can tell that the card still renders ok if there is a lot of text to display. What should we do? Should we truncate it or should we do something else? Show multiple lines? Show the whole thing? Make it expandable?",
            commands: [
                chatCommand,
                banCommand,
                weatherCommand,
                multiplyCommand,
                calculateCommand,
                pingPong,
            ],
        },
    },
];

export const testMatches: BotMatch[] = [
    {
        id: "one",
        name: "Kitten bot",
        ownerId: "owner",
        definition: {
            kind: "bot_definition",
            description: "this is just a test bot and it doen't do very much",
            commands: [killCommand, kickPollCommand],
        },
    },
    {
        id: "two",
        name: "Puppy bot",
        ownerId: "owner",
        definition: {
            kind: "bot_definition",
            description:
                "This bot also does not do anything but in this case it has a much longer description. The reason that we need a longer description is so that we can tell that the card still renders ok if there is a lot of text to display. What should we do? Should we truncate it or should we do something else? Show multiple lines? Show the whole thing? Make it expandable?",
            commands: [
                chatCommand,
                banCommand,
                weatherCommand,
                multiplyCommand,
                calculateCommand,
                pingPong,
            ],
        },
    },
];

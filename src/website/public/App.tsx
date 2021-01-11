import React from "react";

import { setupBackgroundTasks } from "./backgroundTasks";

import Main from "./components/Main";
import Side from "./components/Side";

export default App;

function App() {
    setupBackgroundTasks();

    return (
        <>
            <Side />
            <Main />
        </>
    );
}

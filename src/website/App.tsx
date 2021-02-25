import React from "react";
import { useSelector } from "react-redux";
import { Container, Grid, makeStyles, Theme, useMediaQuery, useTheme } from "@material-ui/core";

import { RootState } from "./reducers";
import { setupBackgroundTasks } from "./backgroundTasks";
import { Option } from "./domain/model/common";
import { SidePanelState } from "./reducers/sidePanelReducer";
import { RightPanelType } from "./actions/changeSidePanel";
import LeftPanel from "./components/leftPanel/LeftPanel";
import MainPanel from "./components/mainPanel/MainPanel";
import RightPanel from "./components/rightPanel/RightPanel";

export default App;

const useStyles = makeStyles((theme: Theme) => ({
    container: {
        padding: 24,
        height: "100vh",
        "&.no-padding": {
            padding: 0
        }
    },
    grid: {
        height: "100%",
        overflow: "hidden"
    },
    left: {
        height: "100%",
        backgroundColor: "white",
        borderRight: "1px solid #dddddd",
        width: "40%",
        "&.rightPanelActive": {
            width: "30%"
        }
    },
    main: {
        height: "100%",
        backgroundColor: "#3dc5ee",
        width: "60%",
        "&.rightPanelActive": {
            width: "40%"
        }
    },
    right: {
        height: "100%",
        backgroundColor: "white",
        borderLeft: "1px solid #dddddd",
        width: "30%"
    }
}));

function App() {
    const classes = useStyles();
    const sidePanelState = useSelector((state: RootState) => state.sidePanelState);
    const theme = useTheme();
    const removePadding = useMediaQuery(theme.breakpoints.down("md"));

    setupBackgroundTasks();

    function buildLeftPanel(sidePanelState: SidePanelState): JSX.Element {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = classes.left;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <Grid
                item
                container
                direction="column"
                wrap="nowrap"
                className={className}>
                <LeftPanel type={sidePanelState.leftPanel} />
            </Grid>
        );
    }

    function buildMainPanel(sidePanelState: SidePanelState): JSX.Element  {
        const rightPanelActive = sidePanelState.rightPanel !== RightPanelType.None;
        let className = "main-panel " + classes.main;
        if (rightPanelActive) {
            className += " rightPanelActive";
        }

        return (
            <Grid
                item
                container
                direction="column"
                className={className}>
                <MainPanel />
            </Grid>
        );
    }
    
    function buildRightPanel(sidePanelState: SidePanelState): Option<JSX.Element>  {
        if (sidePanelState.rightPanel === RightPanelType.None) {
            return null;
        }

        return (
            <Grid item className={classes.right}>
                <RightPanel type={sidePanelState.rightPanel} />
            </Grid>
        );
    }

    let containerClass = classes.container;
    if (removePadding) {
        containerClass += " no-padding";
    }

    return (
        <Container maxWidth="lg" className={containerClass}>
            <Grid container wrap="nowrap" className={classes.grid}>
                {buildLeftPanel(sidePanelState)}
                {buildMainPanel(sidePanelState)}
                {buildRightPanel(sidePanelState)}
            </Grid>
        </Container>
    );
}

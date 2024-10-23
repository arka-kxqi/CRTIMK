import App from "./app";
import React from "react";
import { Wallet } from "./common/near-wallet";
import ReactDOM from "react-dom/client";
import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import { RecoilRoot } from "recoil";

const reactRoot = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

// create the Wallet and the Contract
export const wallet = new Wallet();

const theme = createTheme({
  palette: {
    mode: "dark",
    action: {
      active: "rgb(102, 178, 255)", // Closest MUI: blue[300]
    },
    background: {
      default: "rgb(0, 30, 60)", //Closes MUI: blue[900], but looks awful
      paper: "rgb(0, 30, 60)",
    },
    text: {
      primary: "rgb(189, 189, 189)", //MUI grey[300] is the exact same
      secondary: "rgb(204, 204, 204)", //No good MUI color
    },
    divider: "rgba(194, 224, 255, 0.08)", //No good MUI color
  },
  typography: {
    fontFamily: [
      "Manrope",
      "Arial",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "sans-serif",
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(","),
  },
});

window.onload = () => {
  wallet
    .startUp()
    .then((isSignedIn: boolean) => {
      reactRoot.render(
        <React.StrictMode>
          <RecoilRoot>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <App isSignedIn={isSignedIn} wallet={wallet} />
            </ThemeProvider>
          </RecoilRoot>
        </React.StrictMode>
      );
    })
    .catch((e) => {
      reactRoot.render(
        <div style={{ color: "red" }}>
          Error: <code>{e.message}</code>
        </div>
      );
      console.error(e);
    });
};

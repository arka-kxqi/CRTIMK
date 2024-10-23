import React, { useContext } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import { default as Logo } from "../../assets/svg/faws-logo-purple.svg";
import { WalletContext } from "../app";
import { AccountBalanceWallet } from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";

export default function NavBar({ isSignedIn }: { isSignedIn: boolean }) {
  const wallet = useContext(WalletContext);
  const navigate = useNavigate();

  let walletComponent;
  if (isSignedIn) {
    walletComponent = (
      <SignOutButton
        accountId={wallet.accountId}
        onClick={() => {
          navigate("/");
          wallet.signOut();
        }}
      />
    );
  } else {
    walletComponent = <SignInPrompt onClick={() => wallet.signIn()} />;
  }

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Box sx={{ display: "contents" }}>
            <Link to="/">
              <img style={{ width: "50px", height: "50px" }} src={Logo} />
            </Link>
          </Box>
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
            <Link
              to={"/bounty"}
              style={{
                textDecoration: "none",
                pointerEvents: !isSignedIn ? "none" : "auto",
              }}
            >
              <Button
                key="Bounties"
                sx={{ my: 2, display: "block" }}
                disabled={!isSignedIn}
              >
                Bounty
              </Button>
            </Link>
            <Link
              to={"/node"}
              style={{
                textDecoration: "none",
                pointerEvents: !isSignedIn ? "none" : "auto",
              }}
            >
              <Button
                key="Node"
                sx={{ my: 2, display: "block" }}
                disabled={!isSignedIn}
              >
                Node
              </Button>
            </Link>
          </Box>
          <Box sx={{ flexGrow: 0 }}>{walletComponent}</Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export function SignInPrompt({ onClick }) {
  return (
    <Button
      onClick={onClick}
      variant="contained"
      startIcon={<AccountBalanceWallet />}
    >
      Connect Wallet
    </Button>
  );
}

function SignOutButton({ accountId, onClick }: { accountId: string; onClick }) {
  return (
    <Button
      onClick={onClick}
      variant="contained"
      startIcon={<AccountBalanceWallet />}
    >
      {accountId}
    </Button>
  );
}

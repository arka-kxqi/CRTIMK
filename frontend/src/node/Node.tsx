import React from "react";
import { Box, Button, Modal, Typography } from "@mui/material";
import RegisterNode from "./register-node";
import { Add } from "@mui/icons-material";
import ExistingNode from "./existing-node";

const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

export default function Node() {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  return (
    <>
      <Button variant="contained" onClick={handleOpen} startIcon={<Add />}>
        Create Node
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="create-bounty-modal-title"
        aria-describedby="create-bounty-modal-description"
      >
        <Box sx={style}>
          <Typography
            id="create-bounty-modal-title"
            variant="h5"
            component="h2"
          >
            Create Node
          </Typography>
          <RegisterNode handleClose={handleClose} />
        </Box>
      </Modal>
      <ExistingNode />
    </>
  );
}

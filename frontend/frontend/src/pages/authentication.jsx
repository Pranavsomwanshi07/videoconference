import * as React from "react";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Snackbar from "@mui/material/Snackbar";

import { createTheme, ThemeProvider } from "@mui/material/styles";

import { AuthContext } from "../contexts/AuthContext";

const defaultTheme = createTheme();

export default function Authentication() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");

  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");

  // 0 = Login, 1 = Register
  const [formState, setFormState] = React.useState(0);

  const [open, setOpen] = React.useState(false);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  const handleAuth = async () => {
    setError("");

    try {
      if (!username || !password) {
        setError("Username and password are required.");
        return;
      }

      // Login
      if (formState === 0) {
        await handleLogin(username, password);
        return;
      }

      // Register
      if (!name) {
        setError("Full name is required.");
        return;
      }

      const result = await handleRegister(
        name,
        username,
        password
      );

      setMessage(result || "Registration successful!");
      setOpen(true);

      // Switch to login
      setFormState(0);

      // Clear fields
      setName("");
      setUsername("");
      setPassword("");
    } catch (err) {
      console.error(err);

      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Something went wrong.";

      setError(errorMessage);
    }
  };

  const handleCloseSnackbar = () => {
    setOpen(false);
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Grid container component="main" sx={{ height: "100vh" }}>
        <CssBaseline />

        {/* Left Image */}
        <Grid
          item
          xs={false}
          sm={4}
          md={7}
          sx={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1497366754035-f200968a6e72)",
            backgroundRepeat: "no-repeat",
            backgroundColor: (theme) =>
              theme.palette.mode === "light"
                ? theme.palette.grey[50]
                : theme.palette.grey[900],
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Authentication Form */}
        <Grid
          item
          xs={12}
          sm={8}
          md={5}
          component={Paper}
          elevation={6}
          square
        >
          <Box
            sx={{
              my: 8,
              mx: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Icon */}
            <Avatar
              sx={{
                m: 1,
                bgcolor: "secondary.main",
              }}
            >
              <LockOutlinedIcon />
            </Avatar>

            {/* Login / Register Buttons */}
            <Box sx={{ mb: 2 }}>
              <Button
                variant={formState === 0 ? "contained" : "text"}
                onClick={() => {
                  setFormState(0);
                  setError("");
                }}
              >
                Sign In
              </Button>

              <Button
                variant={formState === 1 ? "contained" : "text"}
                onClick={() => {
                  setFormState(1);
                  setError("");
                }}
              >
                Sign Up
              </Button>
            </Box>

            {/* Form */}
            <Box
              component="form"
              noValidate
              sx={{
                mt: 1,
                width: "100%",
              }}
              onSubmit={(e) => {
                e.preventDefault();
                handleAuth();
              }}
            >
              {/* Full Name - Register only */}
              {formState === 1 && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Full Name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              {/* Username */}
              <TextField
                margin="normal"
                required
                fullWidth
                label="Username"
                value={username}
                autoFocus={formState === 0}
                onChange={(e) => setUsername(e.target.value)}
              />

              {/* Password */}
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {/* Error */}
              {error && (
                <Box
                  sx={{
                    color: "error.main",
                    mt: 1,
                    fontSize: "14px",
                  }}
                >
                  {error}
                </Box>
              )}

              {/* Submit */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                }}
              >
                {formState === 0 ? "Login" : "Register"}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Success Snackbar */}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={message}
      />
    </ThemeProvider>
  );
}
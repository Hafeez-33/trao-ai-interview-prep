import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout.js";
import { HomePage } from "@/pages/HomePage.js";
import { LoginPage } from "@/pages/LoginPage.js";
import { RegisterPage } from "@/pages/RegisterPage.js";
import { NotFoundPage } from "@/pages/NotFoundPage.js";

/**
 * Foundation application routes.
 * Phase 12 configures only /, /login, /register, and * (404).
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

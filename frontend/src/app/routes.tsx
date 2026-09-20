import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout.js";
import { HomePage } from "@/pages/HomePage.js";
import { LoginPage } from "@/pages/LoginPage.js";
import { RegisterPage } from "@/pages/RegisterPage.js";
import { CreateKitPage } from "@/pages/CreateKitPage.js";
import { GenerationPage } from "@/pages/GenerationPage.js";
import { KitPage } from "@/pages/KitPage.js";
import { KitBuilderPage } from "@/pages/KitBuilderPage.js";
import { NotFoundPage } from "@/pages/NotFoundPage.js";

/**
 * Application routes.
 * Phase 14 configures /, /login, /register, /kits/new, /kits/:id/generate, /kits/:id, /kits/:id/builder, and * (404).
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
        path: "kits/new",
        element: <CreateKitPage />,
      },
      {
        path: "kits/:id/generate",
        element: <GenerationPage />,
      },
      {
        path: "kits/:id",
        element: <KitPage />,
      },
      {
        path: "kits/:id/builder",
        element: <KitBuilderPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);

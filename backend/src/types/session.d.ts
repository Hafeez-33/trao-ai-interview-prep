import "express-session";
import { SafeUser } from "./auth.js";

declare module "express-session" {
  interface SessionData {
    user?: SafeUser;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

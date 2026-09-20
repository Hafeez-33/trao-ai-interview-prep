import { ObjectId } from "mongodb";

export interface IUser {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeUser {
  id: string;
  email: string;
  name?: string;
}

export function toSafeUser(user: IUser): SafeUser {
  return {
    id: user._id ? user._id.toString() : "",
    email: user.email,
    ...(user.name ? { name: user.name } : {}),
  };
}

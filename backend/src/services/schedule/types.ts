import {
  KitRequirement,
  KitQuestion,
  InternalKitQuestion,
} from "../../types/kit.js";

/**
 * Parameters for generating a deterministic interview preparation schedule.
 */
export interface ScheduleGenerationParams {
  requirements: KitRequirement[];
  questions: (KitQuestion | InternalKitQuestion)[];
  days: number;
}

/**
 * Deterministic schedule error with taxonomy code and HTTP status.
 */
export class ScheduleError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code = "SCHEDULE_GENERATION_ERROR",
    status = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ScheduleError";
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ScheduleError.prototype);
  }
}

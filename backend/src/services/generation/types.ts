import { InternalKitQuestion, InternalKitFlashcard } from "../../types/kit.js";

export interface RawGeneratedQuestion {
  id?: unknown;
  requirement_ids?: unknown;
  category?: unknown;
  prompt?: unknown;
  answer_outline?: unknown;
  difficulty?: unknown;
}

export interface RawGeneratedFlashcard {
  id?: unknown;
  requirement_ids?: unknown;
  front?: unknown;
  back?: unknown;
}

export interface RawGenerationOutput {
  questions?: RawGeneratedQuestion[];
  flashcards?: RawGeneratedFlashcard[];
}

export interface GenerationResult {
  questions: InternalKitQuestion[];
  flashcards: InternalKitFlashcard[];
}

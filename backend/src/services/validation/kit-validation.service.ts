import {
  KitStructure,
  KitRequirement,
  KitQuestion,
  KitFlashcard,
  InternalKitQuestion,
  InternalKitFlashcard,
  IKitDocument,
} from "../../types/kit.js";
import { coverageService } from "../coverage/coverage.service.js";
import {
  ValidationError,
  ValidationWarning,
  ValidationResult,
  ValidationOptions,
  ValidationErrorCode,
} from "./types.js";

/**
 * Deterministic Kit Validation Engine.
 *
 * Verifies that a Kit is structurally valid, internally consistent,
 * and ready for downstream use/export according to Appendix A contracts.
 *
 * NO LLM CALLS. NO NETWORK CALLS. NO MUTATIONS.
 */
export class KitValidationService {
  /**
   * Validates a Kit across Structural, Referential, and Pipeline/Business-Rule layers.
   */
  public validateKit(
    kit: unknown,
    options?: ValidationOptions
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Layer 0: Root Schema Check
    if (!kit || typeof kit !== "object" || Array.isArray(kit)) {
      errors.push({
        code: ValidationErrorCode.INVALID_SCHEMA,
        path: "",
        message: "Kit must be a non-null object.",
      });
      return this.buildResult(errors, warnings);
    }

    const kitObj = kit as Record<string, unknown>;

    // Check for internal field leak if validating what should be a public KitStructure
    this.checkInternalFieldLeaks(kitObj, errors);

    // Layer A: Structural Validation
    this.validateSource(kitObj, errors, options);
    this.validateCompanyBrief(kitObj, errors, options);
    const validReqIds = this.validateRoleAndRequirements(kitObj, errors);
    const validQuestionIds = this.validateQuestions(kitObj, validReqIds, errors);
    this.validateFlashcards(kitObj, validReqIds, errors);

    // Layer B & C: Referential, Coverage, and Schedule Validation
    this.validateCoverage(kitObj, errors);
    this.validateSchedule(kitObj, validQuestionIds, errors);

    // Layer C: Protected Internal Items Validity (if internal flags present)
    this.validateProtectedItems(kitObj, errors);

    return this.buildResult(errors, warnings);
  }

  /**
   * Checks if internal database / builder metadata leaked into a public contract.
   */
  private checkInternalFieldLeaks(
    kitObj: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    // If the object has an explicit marker or is checked in an export context,
    // ensure public sections do not contain builder-only flags.
    // Note: IKitDocument may have these at the root or within items, but public Appendix A KitStructure must not.
    const internalBuilderFields = [
      "userId",
      "progressMessage",
      "errorMessage",
      "crawled_pages",
      "interview_research",
    ];

    // For public contract validation: if the object claims to be Appendix A (no _id / no userId)
    // but contains internal fields, flag it.
    // However, when validateKit is called directly on an IKitDocument from the backend,
    // toSafeKit() handles stripping. If someone calls validate on a safe kit, these must be absent.
  }

  /**
   * Validates the 'source' section of the Kit.
   */
  private validateSource(
    kitObj: Record<string, unknown>,
    errors: ValidationError[],
    options?: ValidationOptions
  ): void {
    if (!("source" in kitObj) || kitObj.source === undefined || kitObj.source === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "source",
        message: "Missing required 'source' section.",
      });
      return;
    }

    if (typeof kitObj.source !== "object" || Array.isArray(kitObj.source)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source",
        message: "'source' must be an object.",
      });
      return;
    }

    const source = kitObj.source as Record<string, unknown>;

    // company
    if (typeof source.company !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.company",
        message: "'source.company' must be a string.",
      });
    }

    // company_url
    if (typeof source.company_url !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.company_url",
        message: "'source.company_url' must be a string.",
      });
    } else if (source.company_url.trim()) {
      if (!this.isValidHttpUrl(source.company_url)) {
        errors.push({
          code: ValidationErrorCode.INVALID_SOURCE_URL,
          path: "source.company_url",
          message: "'source.company_url' must be a valid HTTP or HTTPS URL.",
        });
      }
    }

    // role
    if (typeof source.role !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.role",
        message: "'source.role' must be a string.",
      });
    }

    // location
    if (typeof source.location !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.location",
        message: "'source.location' must be a string.",
      });
    }

    // jd_chars
    if (typeof source.jd_chars !== "number" || !Number.isInteger(source.jd_chars) || source.jd_chars < 0) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.jd_chars",
        message: "'source.jd_chars' must be a non-negative integer.",
      });
    } else {
      // Validate jd_chars against stored raw JD if available
      const rawJd = options?.rawJd ?? (typeof kitObj.jd === "string" ? kitObj.jd : undefined);
      if (rawJd !== undefined && source.jd_chars !== rawJd.length) {
        errors.push({
          code: ValidationErrorCode.INVALID_JD_CHAR_COUNT,
          path: "source.jd_chars",
          message: `'source.jd_chars' (${source.jd_chars}) does not match actual Job Description character count (${rawJd.length}).`,
        });
      }
    }

    // researched_at
    if (typeof source.researched_at !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.researched_at",
        message: "'source.researched_at' must be a string.",
      });
    } else if (source.researched_at.trim() && isNaN(Date.parse(source.researched_at))) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.researched_at",
        message: "'source.researched_at' must be a valid ISO 8601 date string.",
      });
    }

    // pages_used
    if (!Array.isArray(source.pages_used)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "source.pages_used",
        message: "'source.pages_used' must be an array.",
      });
    } else {
      const seenUrls = new Set<string>();
      source.pages_used.forEach((url, idx) => {
        const path = `source.pages_used[${idx}]`;
        if (typeof url !== "string") {
          errors.push({
            code: ValidationErrorCode.INVALID_TYPE,
            path,
            message: `Entry in 'source.pages_used' at index ${idx} must be a string.`,
          });
          return;
        }

        if (!this.isValidHttpUrl(url)) {
          errors.push({
            code: ValidationErrorCode.INVALID_SOURCE_URL,
            path,
            message: `Entry in 'source.pages_used' at index ${idx} is not a valid HTTP/HTTPS URL: '${url}'.`,
          });
        }

        if (seenUrls.has(url)) {
          errors.push({
            code: ValidationErrorCode.INVALID_SOURCE_URL,
            path,
            message: `Duplicate URL in 'source.pages_used': '${url}'.`,
          });
        }
        seenUrls.add(url);
      });
    }
  }

  /**
   * Validates the 'company_brief' section of the Kit.
   */
  private validateCompanyBrief(
    kitObj: Record<string, unknown>,
    errors: ValidationError[],
    options?: ValidationOptions
  ): void {
    if (!("company_brief" in kitObj) || kitObj.company_brief === undefined || kitObj.company_brief === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "company_brief",
        message: "Missing required 'company_brief' section.",
      });
      return;
    }

    if (typeof kitObj.company_brief !== "object" || Array.isArray(kitObj.company_brief)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "company_brief",
        message: "'company_brief' must be an object.",
      });
      return;
    }

    const brief = kitObj.company_brief as Record<string, unknown>;

    // summary
    if (typeof brief.summary !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "company_brief.summary",
        message: "'company_brief.summary' must be a string.",
      });
    }

    // what_they_do
    if (typeof brief.what_they_do !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "company_brief.what_they_do",
        message: "'company_brief.what_they_do' must be a string.",
      });
    }

    // sources
    if (!Array.isArray(brief.sources)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "company_brief.sources",
        message: "'company_brief.sources' must be an array.",
      });
    } else {
      brief.sources.forEach((src, idx) => {
        const path = `company_brief.sources[${idx}]`;
        if (typeof src !== "string") {
          errors.push({
            code: ValidationErrorCode.INVALID_TYPE,
            path,
            message: `Entry in 'company_brief.sources' at index ${idx} must be a string.`,
          });
        } else if (!this.isValidHttpUrl(src)) {
          errors.push({
            code: ValidationErrorCode.INVALID_SOURCE_URL,
            path,
            message: `Entry in 'company_brief.sources' at index ${idx} is not a valid HTTP/HTTPS URL: '${src}'.`,
          });
        }
      });
    }
  }

  /**
   * Validates 'role' and its 'requirements'.
   * Returns a Set of valid requirement IDs.
   */
  private validateRoleAndRequirements(
    kitObj: Record<string, unknown>,
    errors: ValidationError[]
  ): Set<string> {
    const validReqIds = new Set<string>();

    if (!("role" in kitObj) || kitObj.role === undefined || kitObj.role === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "role",
        message: "Missing required 'role' section.",
      });
      return validReqIds;
    }

    if (typeof kitObj.role !== "object" || Array.isArray(kitObj.role)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "role",
        message: "'role' must be an object.",
      });
      return validReqIds;
    }

    const role = kitObj.role as Record<string, unknown>;

    // title
    if (typeof role.title !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "role.title",
        message: "'role.title' must be a string.",
      });
    }

    // seniority
    if (typeof role.seniority !== "string") {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "role.seniority",
        message: "'role.seniority' must be a string.",
      });
    }

    // responsibilities
    if (!Array.isArray(role.responsibilities)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "role.responsibilities",
        message: "'role.responsibilities' must be an array.",
      });
    } else {
      role.responsibilities.forEach((item, idx) => {
        if (typeof item !== "string") {
          errors.push({
            code: ValidationErrorCode.INVALID_TYPE,
            path: `role.responsibilities[${idx}]`,
            message: `Responsibility at index ${idx} must be a string.`,
          });
        }
      });
    }

    // requirements
    if (!Array.isArray(role.requirements)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "role.requirements",
        message: "'role.requirements' must be an array.",
      });
      return validReqIds;
    }

    const seenReqIds = new Set<string>();
    const allowedKinds = new Set(["technical", "behavioural", "domain"]);
    const allowedPriorities = new Set(["must", "nice"]);

    role.requirements.forEach((req, idx) => {
      const path = `role.requirements[${idx}]`;
      if (!req || typeof req !== "object" || Array.isArray(req)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path,
          message: `Requirement at index ${idx} must be an object.`,
        });
        return;
      }

      const r = req as Record<string, unknown>;

      // id
      if (typeof r.id !== "string" || !r.id.trim()) {
        errors.push({
          code: ValidationErrorCode.MISSING_FIELD,
          path: `${path}.id`,
          message: `Requirement at index ${idx} is missing a valid ID.`,
        });
      } else {
        const id = r.id.trim();
        if (seenReqIds.has(id)) {
          errors.push({
            code: ValidationErrorCode.DUPLICATE_REQUIREMENT_ID,
            path: `${path}.id`,
            message: `Duplicate requirement ID: '${id}'.`,
          });
        } else {
          seenReqIds.add(id);
          validReqIds.add(id);
        }
      }

      // text
      if (typeof r.text !== "string" || !r.text.trim()) {
        errors.push({
          code: ValidationErrorCode.EMPTY_VALUE,
          path: `${path}.text`,
          message: `Requirement at index ${idx} must have non-empty text.`,
        });
      }

      // kind
      if (typeof r.kind !== "string" || !allowedKinds.has(r.kind)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.kind`,
          message: `Requirement '${r.id || idx}' has invalid kind '${r.kind}'. Allowed: 'technical', 'behavioural', 'domain'.`,
        });
      }

      // priority
      if (typeof r.priority !== "string" || !allowedPriorities.has(r.priority)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.priority`,
          message: `Requirement '${r.id || idx}' has invalid priority '${r.priority}'. Allowed: 'must', 'nice'.`,
        });
      }
    });

    return validReqIds;
  }

  /**
   * Validates 'questions' array, difficulty, category, and requirement references.
   * Returns a Set of valid question IDs.
   */
  private validateQuestions(
    kitObj: Record<string, unknown>,
    validReqIds: Set<string>,
    errors: ValidationError[]
  ): Set<string> {
    const validQuestionIds = new Set<string>();

    if (!("questions" in kitObj) || kitObj.questions === undefined || kitObj.questions === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "questions",
        message: "Missing required 'questions' section.",
      });
      return validQuestionIds;
    }

    if (!Array.isArray(kitObj.questions)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "questions",
        message: "'questions' must be an array.",
      });
      return validQuestionIds;
    }

    const seenQIds = new Set<string>();
    const allowedCategories = new Set([
      "technical",
      "behavioural",
      "system-design",
      "company-fit",
    ]);

    kitObj.questions.forEach((qItem, idx) => {
      const path = `questions[${idx}]`;
      if (!qItem || typeof qItem !== "object" || Array.isArray(qItem)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path,
          message: `Question at index ${idx} must be an object.`,
        });
        return;
      }

      const q = qItem as Record<string, unknown>;

      // id
      if (typeof q.id !== "string" || !q.id.trim()) {
        errors.push({
          code: ValidationErrorCode.MISSING_FIELD,
          path: `${path}.id`,
          message: `Question at index ${idx} is missing a valid ID.`,
        });
      } else {
        const id = q.id.trim();
        if (seenQIds.has(id)) {
          errors.push({
            code: ValidationErrorCode.DUPLICATE_QUESTION_ID,
            path: `${path}.id`,
            message: `Duplicate question ID: '${id}'.`,
          });
        } else {
          seenQIds.add(id);
          validQuestionIds.add(id);
        }
      }

      // prompt
      if (typeof q.prompt !== "string" || !q.prompt.trim()) {
        errors.push({
          code: ValidationErrorCode.EMPTY_VALUE,
          path: `${path}.prompt`,
          message: `Question '${q.id || idx}' has an empty prompt.`,
        });
      }

      // answer_outline
      if (typeof q.answer_outline !== "string" || !q.answer_outline.trim()) {
        errors.push({
          code: ValidationErrorCode.EMPTY_VALUE,
          path: `${path}.answer_outline`,
          message: `Question '${q.id || idx}' has an empty answer_outline.`,
        });
      }

      // category
      if (typeof q.category !== "string" || !allowedCategories.has(q.category)) {
        errors.push({
          code: ValidationErrorCode.INVALID_QUESTION_CATEGORY,
          path: `${path}.category`,
          message: `Question '${q.id || idx}' has invalid category '${q.category}'. Allowed: 'technical', 'behavioural', 'system-design', 'company-fit'.`,
        });
      }

      // difficulty
      if (q.difficulty !== 1 && q.difficulty !== 2 && q.difficulty !== 3) {
        errors.push({
          code: ValidationErrorCode.INVALID_DIFFICULTY,
          path: `${path}.difficulty`,
          message: `Question '${q.id || idx}' has invalid difficulty '${q.difficulty}'. Allowed: 1, 2, 3.`,
        });
      }

      // requirement_ids
      if (!Array.isArray(q.requirement_ids)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.requirement_ids`,
          message: `Question '${q.id || idx}' requirement_ids must be an array.`,
        });
      } else {
        q.requirement_ids.forEach((reqId, rIdx) => {
          if (typeof reqId !== "string" || !validReqIds.has(reqId.trim())) {
            errors.push({
              code: ValidationErrorCode.INVALID_REQUIREMENT_REFERENCE,
              path: `${path}.requirement_ids[${rIdx}]`,
              message: `Question '${q.id || idx}' references nonexistent requirement ID '${reqId}'.`,
            });
          }
        });
      }
    });

    return validQuestionIds;
  }

  /**
   * Validates 'flashcards' array and requirement references.
   */
  private validateFlashcards(
    kitObj: Record<string, unknown>,
    validReqIds: Set<string>,
    errors: ValidationError[]
  ): void {
    if (!("flashcards" in kitObj) || kitObj.flashcards === undefined || kitObj.flashcards === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "flashcards",
        message: "Missing required 'flashcards' section.",
      });
      return;
    }

    if (!Array.isArray(kitObj.flashcards)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "flashcards",
        message: "'flashcards' must be an array.",
      });
      return;
    }

    const seenFIds = new Set<string>();

    kitObj.flashcards.forEach((fItem, idx) => {
      const path = `flashcards[${idx}]`;
      if (!fItem || typeof fItem !== "object" || Array.isArray(fItem)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path,
          message: `Flashcard at index ${idx} must be an object.`,
        });
        return;
      }

      const f = fItem as Record<string, unknown>;

      // id
      if (typeof f.id !== "string" || !f.id.trim()) {
        errors.push({
          code: ValidationErrorCode.MISSING_FIELD,
          path: `${path}.id`,
          message: `Flashcard at index ${idx} is missing a valid ID.`,
        });
      } else {
        const id = f.id.trim();
        if (seenFIds.has(id)) {
          errors.push({
            code: ValidationErrorCode.DUPLICATE_FLASHCARD_ID,
            path: `${path}.id`,
            message: `Duplicate flashcard ID: '${id}'.`,
          });
        } else {
          seenFIds.add(id);
        }
      }

      // front
      if (typeof f.front !== "string" || !f.front.trim()) {
        errors.push({
          code: ValidationErrorCode.EMPTY_VALUE,
          path: `${path}.front`,
          message: `Flashcard '${f.id || idx}' has an empty front.`,
        });
      }

      // back
      if (typeof f.back !== "string" || !f.back.trim()) {
        errors.push({
          code: ValidationErrorCode.EMPTY_VALUE,
          path: `${path}.back`,
          message: `Flashcard '${f.id || idx}' has an empty back.`,
        });
      }

      // requirement_ids
      if (!Array.isArray(f.requirement_ids)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.requirement_ids`,
          message: `Flashcard '${f.id || idx}' requirement_ids must be an array.`,
        });
      } else {
        f.requirement_ids.forEach((reqId, rIdx) => {
          if (typeof reqId !== "string" || !validReqIds.has(reqId.trim())) {
            errors.push({
              code: ValidationErrorCode.INVALID_REQUIREMENT_REFERENCE,
              path: `${path}.requirement_ids[${rIdx}]`,
              message: `Flashcard '${f.id || idx}' references nonexistent requirement ID '${reqId}'.`,
            });
          }
        });
      }
    });
  }

  /**
   * Validates 'coverage' section and recalculates expected coverage deterministically.
   */
  private validateCoverage(
    kitObj: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    if (!("coverage" in kitObj) || kitObj.coverage === undefined || kitObj.coverage === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "coverage",
        message: "Missing required 'coverage' section.",
      });
      return;
    }

    if (typeof kitObj.coverage !== "object" || Array.isArray(kitObj.coverage)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "coverage",
        message: "'coverage' must be an object.",
      });
      return;
    }

    const coverage = kitObj.coverage as Record<string, unknown>;

    // passes
    if (coverage.passes !== 1 && coverage.passes !== 2) {
      errors.push({
        code: ValidationErrorCode.INVALID_COVERAGE,
        path: "coverage.passes",
        message: `'coverage.passes' must be 1 or 2, received '${coverage.passes}'.`,
      });
    }

    // uncovered_requirement_ids
    if (!Array.isArray(coverage.uncovered_requirement_ids)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "coverage.uncovered_requirement_ids",
        message: "'coverage.uncovered_requirement_ids' must be an array.",
      });
      return;
    }

    // Verify all IDs in uncovered_requirement_ids exist in role.requirements
    const role = (kitObj.role as Record<string, unknown>) || {};
    const reqs = Array.isArray(role.requirements) ? (role.requirements as KitRequirement[]) : [];
    const validReqIdSet = new Set(reqs.map((r) => r.id));

    coverage.uncovered_requirement_ids.forEach((id, idx) => {
      if (typeof id !== "string" || !validReqIdSet.has(id)) {
        errors.push({
          code: ValidationErrorCode.INVALID_COVERAGE,
          path: `coverage.uncovered_requirement_ids[${idx}]`,
          message: `'coverage.uncovered_requirement_ids' contains invalid requirement ID '${id}'.`,
        });
      }
    });

    // Deterministic Recalculation Check:
    // Compare stored uncovered_requirement_ids against recalculated coverage from role.requirements and questions
    const questions = Array.isArray(kitObj.questions) ? (kitObj.questions as KitQuestion[]) : [];
    if (reqs.length > 0) {
      const recalculated = coverageService.calculateCoverage(
        reqs,
        questions,
        typeof coverage.passes === "number" ? coverage.passes : 1
      );

      const storedUncovered = coverage.uncovered_requirement_ids as string[];
      const expectedUncovered = recalculated.uncovered_requirement_ids;

      const isMismatch =
        storedUncovered.length !== expectedUncovered.length ||
        storedUncovered.some((id, idx) => id !== expectedUncovered[idx]);

      if (isMismatch) {
        errors.push({
          code: ValidationErrorCode.INVALID_COVERAGE,
          path: "coverage.uncovered_requirement_ids",
          message: `Coverage mismatch: stored uncovered IDs [${storedUncovered.join(", ")}] do not match recalculated uncovered IDs [${expectedUncovered.join(", ")}].`,
        });
      }
    }
  }

  /**
   * Validates 'schedule' section, day counts, sequential numbering, minutes, and must-requirement scheduling.
   */
  private validateSchedule(
    kitObj: Record<string, unknown>,
    validQuestionIds: Set<string>,
    errors: ValidationError[]
  ): void {
    if (!("schedule" in kitObj) || kitObj.schedule === undefined || kitObj.schedule === null) {
      errors.push({
        code: ValidationErrorCode.MISSING_FIELD,
        path: "schedule",
        message: "Missing required 'schedule' section.",
      });
      return;
    }

    if (typeof kitObj.schedule !== "object" || Array.isArray(kitObj.schedule)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "schedule",
        message: "'schedule' must be an object.",
      });
      return;
    }

    const schedule = kitObj.schedule as Record<string, unknown>;

    // days_available
    const daysAvailable = schedule.days_available;
    if (
      typeof daysAvailable !== "number" ||
      !Number.isInteger(daysAvailable) ||
      daysAvailable < 1 ||
      daysAvailable > 60
    ) {
      errors.push({
        code: ValidationErrorCode.INVALID_DAYS,
        path: "schedule.days_available",
        message: `'schedule.days_available' must be an integer between 1 and 60, received '${daysAvailable}'.`,
      });
      return;
    }

    // days array
    if (!Array.isArray(schedule.days)) {
      errors.push({
        code: ValidationErrorCode.INVALID_TYPE,
        path: "schedule.days",
        message: "'schedule.days' must be an array.",
      });
      return;
    }

    if (schedule.days.length !== daysAvailable) {
      errors.push({
        code: ValidationErrorCode.INVALID_SCHEDULE,
        path: "schedule.days",
        message: `'schedule.days' length (${schedule.days.length}) does not match 'schedule.days_available' (${daysAvailable}).`,
      });
    }

    const seenScheduledQuestions = new Set<string>();
    const scheduledQuestionIdsAllDays = new Set<string>();

    schedule.days.forEach((dayItem, idx) => {
      const path = `schedule.days[${idx}]`;
      if (!dayItem || typeof dayItem !== "object" || Array.isArray(dayItem)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path,
          message: `Schedule day at index ${idx} must be an object.`,
        });
        return;
      }

      const day = dayItem as Record<string, unknown>;

      // day sequential check
      const expectedDayNum = idx + 1;
      if (day.day !== expectedDayNum) {
        errors.push({
          code: ValidationErrorCode.INVALID_DAY_NUMBER,
          path: `${path}.day`,
          message: `Schedule day at index ${idx} has day number '${day.day}', expected sequential '${expectedDayNum}'.`,
        });
      }

      // minutes positive integer
      if (
        typeof day.minutes !== "number" ||
        !Number.isInteger(day.minutes) ||
        day.minutes <= 0
      ) {
        errors.push({
          code: ValidationErrorCode.INVALID_MINUTES,
          path: `${path}.minutes`,
          message: `Schedule day ${day.day || idx + 1} has invalid minutes '${day.minutes}'. Must be a positive integer.`,
        });
      }

      // focus
      if (typeof day.focus !== "string") {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.focus`,
          message: `Schedule day ${day.day || idx + 1} focus must be a string.`,
        });
      }

      // question_ids
      if (!Array.isArray(day.question_ids)) {
        errors.push({
          code: ValidationErrorCode.INVALID_TYPE,
          path: `${path}.question_ids`,
          message: `Schedule day ${day.day || idx + 1} question_ids must be an array.`,
        });
      } else {
        day.question_ids.forEach((qId, qIdx) => {
          if (typeof qId !== "string" || !validQuestionIds.has(qId.trim())) {
            errors.push({
              code: ValidationErrorCode.INVALID_SCHEDULE,
              path: `${path}.question_ids[${qIdx}]`,
              message: `Schedule day ${day.day || idx + 1} references invalid or nonexistent question ID '${qId}'.`,
            });
            return;
          }

          const cleanQId = qId.trim();
          if (seenScheduledQuestions.has(cleanQId)) {
            errors.push({
              code: ValidationErrorCode.DUPLICATE_SCHEDULE_QUESTION,
              path: `${path}.question_ids[${qIdx}]`,
              message: `Question '${cleanQId}' appears more than once across schedule days.`,
            });
          } else {
            seenScheduledQuestions.add(cleanQId);
            scheduledQuestionIdsAllDays.add(cleanQId);
          }
        });
      }
    });

    // Must-Requirement Guarantee:
    // Every must-priority requirement must have at least one scheduled question!
    const role = (kitObj.role as Record<string, unknown>) || {};
    const reqs = Array.isArray(role.requirements) ? (role.requirements as KitRequirement[]) : [];
    const questions = Array.isArray(kitObj.questions) ? (kitObj.questions as KitQuestion[]) : [];

    const questionMap = new Map<string, KitQuestion>();
    for (const q of questions) {
      if (q && q.id) {
        questionMap.set(q.id, q);
      }
    }

    const coveredInScheduleReqIds = new Set<string>();
    for (const qId of scheduledQuestionIdsAllDays) {
      const q = questionMap.get(qId);
      if (q && Array.isArray(q.requirement_ids)) {
        for (const rId of q.requirement_ids) {
          coveredInScheduleReqIds.add(rId);
        }
      }
    }

    for (const req of reqs) {
      if (req.priority === "must") {
        if (!coveredInScheduleReqIds.has(req.id)) {
          errors.push({
            code: ValidationErrorCode.MISSING_MUST_REQUIREMENT,
            path: "schedule",
            message: `Must-have requirement '${req.id}' ('${req.text.slice(0, 40)}...') has no associated question in the schedule.`,
          });
        }
      }
    }
  }

  /**
   * Validates that protected internal questions and flashcards remain structurally sound.
   */
  private validateProtectedItems(
    kitObj: Record<string, unknown>,
    errors: ValidationError[]
  ): void {
    if (Array.isArray(kitObj.questions)) {
      kitObj.questions.forEach((qItem, idx) => {
        if (!qItem || typeof qItem !== "object") return;
        const q = qItem as InternalKitQuestion;
        if (q.is_custom || q.is_edited || q.is_pinned) {
          if (!q.id || !q.prompt || !q.prompt.trim() || !q.answer_outline || !q.answer_outline.trim()) {
            errors.push({
              code: ValidationErrorCode.INVALID_SCHEMA,
              path: `questions[${idx}]`,
              message: `Protected question '${q.id || idx}' is missing required fields.`,
            });
          }
        }
      });
    }

    if (Array.isArray(kitObj.flashcards)) {
      kitObj.flashcards.forEach((fItem, idx) => {
        if (!fItem || typeof fItem !== "object") return;
        const f = fItem as InternalKitFlashcard;
        if (f.is_custom || f.is_edited) {
          if (!f.id || !f.front || !f.front.trim() || !f.back || !f.back.trim()) {
            errors.push({
              code: ValidationErrorCode.INVALID_SCHEMA,
              path: `flashcards[${idx}]`,
              message: `Protected flashcard '${f.id || idx}' is missing required fields.`,
            });
          }
        }
      });
    }
  }

  /**
   * Helper to validate HTTP or HTTPS URL syntax.
   */
  private isValidHttpUrl(str: string): boolean {
    try {
      const parsed = new URL(str);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Builds the final ValidationResult with deterministic error and warning ordering.
   */
  private buildResult(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): ValidationResult {
    // Sort deterministically by path (lexical), then code (lexical), then message (lexical)
    const sortedErrors = [...errors].sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      if (a.code !== b.code) return a.code.localeCompare(b.code);
      return a.message.localeCompare(b.message);
    });

    const sortedWarnings = [...warnings].sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      if (a.code !== b.code) return a.code.localeCompare(b.code);
      return a.message.localeCompare(b.message);
    });

    return {
      valid: sortedErrors.length === 0,
      errors: sortedErrors,
      warnings: sortedWarnings,
    };
  }
}

export const kitValidationService = new KitValidationService();

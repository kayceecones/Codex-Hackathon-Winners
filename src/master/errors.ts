export class WorkflowTransitionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, options: { code?: string; statusCode?: number; details?: unknown } = {}) {
    super(message);
    this.name = "WorkflowTransitionError";
    this.code = options.code ?? "INVALID_TRANSITION";
    this.statusCode = options.statusCode ?? 409;
    this.details = options.details;
  }
}

export function failTransition(message: string, details?: unknown): never {
  throw new WorkflowTransitionError(message, { details });
}

export function failValidation(message: string, details?: unknown): never {
  throw new WorkflowTransitionError(message, {
    code: "VALIDATION_ERROR",
    statusCode: 400,
    details
  });
}

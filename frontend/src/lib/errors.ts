/**
 * Error handling utility functions
 */

export interface ApiErrorResponse {
  message: string;
  code?: string;
  issues?: Array<{ path: string[]; message: string }>;
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Bilinmeyen hata';
}

/**
 * Type guard for API error response
 */
export function isApiErrorResponse(error: unknown): error is ApiErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Extract error message from API error response
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiErrorResponse(error)) {
    return error.message;
  }
  return getErrorMessage(error);
}

/**
 * Extract validation issues from API error response
 */
export function getApiErrorIssues(error: unknown): Array<{ path: string[]; message: string }> {
  if (isApiErrorResponse(error) && error.issues) {
    return error.issues;
  }
  return [];
}


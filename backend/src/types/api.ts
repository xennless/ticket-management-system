/**
 * API error response type
 */
export interface ApiErrorResponse {
  message: string;
  code?: string;
  issues?: Array<{ path: string[]; message: string }>;
}


/** Typed transport error carrying the HTTP status, thrown by the api/ layer so callers can branch on status (e.g. 401 -> signed out). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

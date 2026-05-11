export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string) {
  return new HttpError(400, message);
}

export function notFound(message: string) {
  return new HttpError(404, message);
}

export function tooManyRequests(message: string) {
  return new HttpError(429, message);
}

export function externalError(message: string) {
  return new HttpError(502, message);
}

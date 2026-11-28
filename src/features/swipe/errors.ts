/** The service cannot safely answer (a required backend or secret is missing in production). Routes map it to 503. */
export class ServiceUnavailableError extends Error {
  readonly status = 503;
}

export interface HealthStatus {
  status: string;
  message: string;
}

/** Envelope the API returns when a listing is requested with `?page` (core/pagination.py). */
export interface RespuestaPaginada<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Page request. `page_size` is capped by the server (default 50, maximum 200). */
export interface ConsultaPaginada {
  page: number;
  page_size?: number;
}

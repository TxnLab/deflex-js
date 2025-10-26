/**
 * Custom HTTP error class with status code and response data
 */
export class HTTPError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
  ) {
    super(`HTTP ${status} ${statusText}`)
    this.name = 'HTTPError'
  }
}

/**
 * Simple wrapper around native fetch for API calls
 */
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options)

  if (!response.ok) {
    let errorData: unknown

    try {
      errorData = await response.json()
    } catch {
      try {
        errorData = await response.text()
      } catch {
        errorData = 'Failed to parse error response'
      }
    }

    throw new HTTPError(
      response.status,
      response.statusText,
      JSON.stringify(errorData),
    )
  }

  return response.json() as Promise<T>
}

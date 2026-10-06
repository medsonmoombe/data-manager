// Helper at the top of your file or in a utils file
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function getKeycloakErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as any;
    return e?.response?.data?.errorMessage || e?.message || 'Unknown error';
  }
  return 'Unknown error';
}
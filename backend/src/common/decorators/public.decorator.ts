import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route (or controller) as publicly accessible.
 *
 * This replaces the `Public()` decorator that came from `nest-keycloak-connect`.
 * `JwtAuthGuard` reads this metadata and skips authentication when it is present.
 * Same name and call signature, so call sites did not need to change beyond the import.
 */
export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

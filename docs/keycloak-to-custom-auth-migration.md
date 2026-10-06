# Keycloak → Custom Auth Migration Plan

Status: **proposed** (nothing implemented yet)
Scope: `backend/`, `client/`, infra config
Reference: this replaces the earlier draft plan, which was directionally correct but missed
several live integration points found in the code.

---

## 1. Where Keycloak is actually wired in today

### Backend — hard dependencies

| File | Coupling |
|---|---|
| `src/app.module.ts` | imports `AuthGuard` from `nest-keycloak-connect`, imports `KeycloakModule`, registers `AuthGuard` as a provider for `moduleRef` lookup |
| `src/common/guards/composite-auth.guard.ts` | resolves the Keycloak `AuthGuard` via `ModuleRef` and delegates to it |
| `src/common/guards/permissions.guard.ts` | resolves the caller with `prisma.user.findUnique({ where: { keycloakUserId } })` |
| `src/main.ts` | registers `UserSyncInterceptor` + `OrgInterceptor` **globally** as `useGlobalInterceptors` |
| `src/common/interceptors/user-sync.interceptor.ts` | on every request: looks up by `keycloakUserId`, **creates a local user from the JWT if missing**, seeds roles |
| `src/common/interceptors/org.interceptor.ts` | on every request: **overwrites `user.orgId`** with the org slugged `default`, then syncs user by `keycloakUserId` |
| `src/modules/user/user-management.service.ts` | `syncUserFromKeycloak(keycloakUser, orgId)` → `findUnique({ where: { keycloakUserId: keycloakUser.sub } })` |
| `src/modules/auth/auth.controller.ts` | `register` creates the org then a Keycloak user, rolls the org back on failure, `upsert` by `keycloakUserId`, `sendVerifyEmail` |
| `src/modules/auth/auth-flow.service.ts` | ~15 `keycloakAdmin.*` calls (validate credentials, attributes, reset password, required actions, getUser) |
| `src/modules/auth/auth-flow.controller.ts` | `@Public()` from `nest-keycloak-connect`; passes `req.user.sub` as `keycloakUserId` |
| `src/modules/auth/invitation.service.ts` | `keycloakAdmin.createUser` + `sendInvitationEmail` |
| `src/modules/invitation/invitation.service.ts` | duplicate implementation, same `keycloakAdmin` calls |
| `src/modules/invitation/invitation.module.ts` | `imports: [KeycloakModule]` |
| `src/modules/team/team.service.ts` | `resolveUserId(keycloakUserId)` → maps Keycloak id to local `User.id` |
| `src/modules/workflow/workflow.controller.ts` | role lookup `findUnique({ where: { keycloakUserId: userId } })` |
| `src/modules/dashboard/dashboard.controller.ts` | reads `req.user.realm_access?.roles` to filter assigned tasks |
| `src/common/errorHandler.ts` | `getKeycloakErrorMessage()` |
| `src/infrastructure/keycloak/` | `keycloak.module.ts`, `keycloak.admin.service.ts`, plus a dead duplicate `keycloak.service.ts` exporting another `KeycloakAdminService` (verified: nothing imports `./keycloak.service`) |
| 11 files | import `Public` from `nest-keycloak-connect` — **22 usages**: `files.controller.ts`, `health.controller.ts`, `integration/webhook.controller.ts`, `public/citizen.controller.ts`, `public/whatsapp-webhook.controller.ts`, `tenant/tenant.controller.ts`, `auth.controller.ts`, `auth-flow.controller.ts` |

### Frontend — mostly already custom

Good news: the client **already** talks to the custom `/auth/api/*` endpoints
(`LoginPage.tsx`, `TwoFactorPage.tsx`, `client/src/api/auth.api.ts`). Keycloak leftovers are:

- `client/src/utils/keycloak.ts` — **dead code**, imported nowhere.
- `client/src/api/axios.ts` — no token refresh; a 401 just logs out.
- `client/src/stores/auth.store.ts` — stores `refreshToken` but nothing consumes it.
- `SystemHealthPage.tsx` — renders a "Keycloak (Auth)" service card.
- `SettingsPage.tsx` — hardcodes "Keycloak (OAuth2/OIDC)" in two places.
- `verifyEmail.tsx` — comments about Keycloak's verify-email endpoint.
- `.env` / `.env.production` — `VITE_KEYCLOAK_*`.

### Schema / infra

- `prisma/schema.prisma` → `User.keycloakUserId String @unique` (**NOT NULL**).
- Seeds write fake ids (`kc-admin-001`, `kc-user-001`, …) in `prisma/seed.ts`, `prisma/seed.js`, `scripts/seed-full.ts`, `scripts/seed-full.js`.
- `scripts/setup-keycloak.*` + npm script `setup:keycloak`.
- `docker-compose.yml` (Keycloak container), `render.yaml` (`KEYCLOAK_*` env), `backend/.env`.

---

## 2. Decisions to confirm before writing code

These three shape everything else. My recommendation is in bold.

### D1. What does `sub` mean in the new token?
`sub` is currently the **Keycloak user id**, and `PermissionsGuard`, `team.service.ts` and
`workflow.controller.ts` each contain a Keycloak→local mapping because of it. Meanwhile
~40 controller call sites pass `req.user?.sub` straight into local columns
(`createdBy`, `updatedBy`, `userId`, `invitedBy`) that are `User.id` foreign keys.

**Recommendation: `sub = local User.id`.** This deletes the mapping helpers in
`team.service.ts` / `workflow.controller.ts` / `permissions.guard.ts` instead of rewriting them,
and makes the FK writes correct. Keep `email`, `orgId`, and `realm_access.roles` in the payload
so the `req.user` shape stays compatible.

### D2. Refresh tokens — stateless or stored?
There is **no refresh endpoint at all today**, and the client never refreshes. With Keycloak the
client could have hit the realm's token endpoint; that disappears.

**Recommendation: opaque/hashed refresh tokens stored in Redis** (the app already has
`cache-manager` + Redis wired globally and `EmailOtpService` already uses it for pending logins
and reset tokens). Store `refresh:<jti>` with the user id and rotate on use; that gives revocation
on logout and on password change. Access tokens stay stateless short-lived JWTs.

### D3. How do existing users get a password?
Keycloak hashes with PBKDF2 and those hashes are **not portable** — they cannot be imported into
`bcrypt`. So every existing account has `passwordHash = NULL` after the migration.

**Recommendation: one-time cutover via forced reset.** Set `requiredActions = ['UPDATE_PASSWORD']`
on every existing row, and have the login path reject a NULL `passwordHash` with a
"set your password" flow driven by the existing `forgot-password` / `reset-password` endpoints.
Seeded demo users can additionally get a known dev password from `DEFAULT_USER_PASSWORD` so local
dev keeps working. Real deployments must be told to expect the reset email.

---

## 3. Target architecture

```
POST /auth/api/login          email+password → bcrypt.compare → optional 2FA → tokens
POST /auth/api/2fa/verify     sessionId+code → tokens
POST /auth/api/refresh        refreshToken   → new access + rotated refresh      ← NEW
POST /auth/api/logout         refreshToken   → revoke                            ← NEW
     /auth/api/forgot-password, /reset-password, /change-password, /me, /2fa/*   (kept)

JwtAuthGuard        replaces Keycloak AuthGuard; validates Bearer JWT, sets req.user
Public              own decorator; JwtAuthGuard skips endpoints marked with it
AuthService         replaces KeycloakAdminService (all local Prisma + bcrypt)
MailService         extracted from EmailOtpService's nodemailer transporter
```

`req.user` contract (kept stable so controllers don't change):

```ts
{
  sub: string,            // local User.id  (D1)
  email: string,
  orgId: string,
  given_name: string,
  family_name: string,
  preferred_username: string,
  realm_access: { roles: string[] },   // Role.name from UserRole
  required_actions: string[],
  isApiKey?: boolean,     // API-key path unchanged
}
```

---

## 4. Phased steps

### Phase 1 — Schema (`prisma/schema.prisma` + migration)
- `User.passwordHash String?   @map("password_hash")`
- `User.emailVerified Boolean  @default(false) @map("email_verified")`
- `User.twoFactorEnabled Boolean @default(false) @map("two_factor_enabled")`
- `User.requiredActions String[] @default([]) @map("required_actions")`
- `User.keycloakUserId String? @unique` — make **nullable** (not dropped yet).
  Note: several `findUnique({ where: { keycloakUserId } })` calls must be removed in the same
  change, since a nullable unique column is unsafe as an identity lookup.
- New migration, then a data backfill marking existing rows with
  `required_actions = ['UPDATE_PASSWORD']` (D3).
- Follow-up migration later (separate PR) to drop `keycloak_user_id` once nothing reads it.

### Phase 2 — JWT infrastructure (`src/infrastructure/jwt/`)
New dependency: **`@nestjs/jwt`** (not installed; `bcryptjs`, `passport`, `@nestjs/passport`
already are). Prefer `@nestjs/jwt` + a hand-written guard over adding `passport-jwt`, matching how
little of the passport stack the project currently uses.
- `jwt.module.ts` — `JwtModule.registerAsync` reading `JWT_SECRET`, `JWT_ACCESS_TTL`,
  `JWT_REFRESH_TTL`.
- `jwt.strategy.ts` / `token.service.ts` — sign/verify access tokens, issue + rotate + revoke
  refresh tokens in Redis (D2).
- `jwt-auth.guard.ts` — replaces the Keycloak `AuthGuard`; must read the **same** public metadata
  key so `@Public()` endpoints stay public, and must not hard-fail when no credentials are present
  (the existing composite guard relies on permissive behaviour).
- `src/common/decorators/public.decorator.ts` — our own `Public()`. Update the 8 controller imports
  mechanically; the decorator name and call sites are unchanged.

### Phase 3 — `AuthService` replaces `KeycloakAdminService`
Map each method 1:1 so `auth-flow.service.ts` changes stay mechanical:

| Old (Keycloak) | New (local) |
|---|---|
| `createUser(data)` | `prisma.user.create` + `bcrypt.hash(password, 12)`; `realmRoles` → local `Role`/`UserRole` |
| `validateCredentials(u, p)` | `findFirst` by email (`username` too) → `bcrypt.compare`; returns user, not tokens |
| `getUser(id)` / `getUserByEmail` / `getUserByUsername` | `prisma.user.findUnique/findFirst` |
| `getUserAttribute(id, k)` | read `twoFactorEnabled` / `requiredActions` |
| `setUserAttribute(id, k, v)` | write `twoFactorEnabled` |
| `resetUserPassword(id, p)` | `bcrypt.hash` → update `passwordHash` |
| `removeRequiredAction(id, a)` | update `requiredActions` array |
| `sendVerifyEmail(id)` | `MailService` + signed verify token |
| `sendInvitationEmail(...)` | `MailService` + the existing `Invitation.token` |
| `deleteUser(id)` | soft-delete (`isActive=false`) rather than hard delete |
| `assignRealmRole` | local `UserRole` insert |

Delete the whole `src/infrastructure/keycloak/` folder (including the dead duplicate
`keycloak.service.ts`) and `getKeycloakErrorMessage` in `errorHandler.ts`.
`AuthModule` imports `JwtModule` instead of `KeycloakModule`.

### Phase 4 — `AuthFlowService` rewrite
Replace every `keycloakAdmin.*` call; the method signatures and return shapes stay identical so
`auth-flow.controller.ts` and the client are untouched.
- `login` — validate locally, read `twoFactorEnabled` from the DB, otherwise issue tokens via
  `TokenService`. No more `parseJwt` of a Keycloak token; the user object comes from the DB row.
- `verify2FA` — `EmailOtpService` stores `userId` instead of `keycloakUserId`; tokens are minted
  here rather than held from Keycloak.
- `forgotPassword` / `resetPassword` — reset token keyed by local `userId`.
- `changePassword` — `bcrypt.compare` current, `bcrypt.hash` new, clear `UPDATE_PASSWORD` action.
- `getMe` — read org name via `organization` relation, not Keycloak attributes.
- `toggle2FA` / `clearRequiredAction` — DB updates.
- `syncUser()` private helper — **delete**; users are created by registration/invitation now.
- Add `refresh(token)` and `logout(token)` for D2.

### Phase 5 — Guards & global interceptors
- `composite-auth.guard.ts`: swap the `moduleRef.get(AuthGuard)` delegation for direct
  `JwtAuthGuard` usage. **API-key path is untouched.**
- `permissions.guard.ts`: `where: { id: user.sub }` and keep the `isApiKey` short-circuit.
- `main.ts` + `user-sync.interceptor.ts` + `org.interceptor.ts`: these currently create users from
  JWTs and overwrite `user.orgId`. Remove `UserSyncInterceptor` entirely; reduce `OrgInterceptor`
  to reading `orgId` from the authenticated user (the guard already sets it) and stop reseeding
  roles per request. The `slug: 'default'` overwrite must not survive — it silently reassigns
  tenants.
- `dashboard.controller.ts`: populate `realm_access.roles` from local roles (via `TokenService`
  at login, or resolved in the guard) so the assigned-task filter keeps working.
- `team.service.ts` / `workflow.controller.ts` / `modules/invitation/invitation.service.ts`
  `createInvitation`: drop the Keycloak→local id resolution now that `sub` is the local id.

### Phase 6 — Registration, invitations, email
- `auth.controller.ts#register`: **simplify**. Org + user + roles become a single
  `prisma.$transaction`; the Keycloak-failure rollback dance and `keycloakUser` cleanup disappear.
- Both `InvitationService` classes (`modules/auth/` and `modules/invitation/`) get rewritten to
  create the local user with a hashed temp password and `requiredActions = ['UPDATE_PASSWORD','VERIFY_EMAIL']`,
  then send the mail via `MailService` with the invitation link.
  **Recommendation: delete the duplicate `modules/auth/invitation.service.ts`** and keep the
  event-emitting one in `modules/invitation/` — flag for confirmation, it's a scope call.
- `modules/invitation/invitation.module.ts`: drop `KeycloakModule`.
- **Email sending** — there are two nodemailer paths today, and they are not interchangeable:
  - `src/modules/auth/services/email-otp.service.ts` — env-driven transporter (`SMTP_*`), global;
    already sends OTP and password-reset mail.
  - `src/modules/notification/adapters/email-smtp.provider.ts` — `EmailSmtpProvider`, a
    tenant-scoped `INotificationProvider` whose SMTP config is passed in per call from the
    `NotificationChannel` DB row (per-org credentials, no delivery tracking).

  **Recommendation: extract `MailService` from `EmailOtpService`'s env-driven transporter** and
  use it for verify + invitation mail. Auth mail must not depend on a tenant having configured a
  `NotificationChannel` row, or invitations silently fail for unconfigured orgs. Reusing
  `EmailSmtpProvider` for auth would need per-organization branding to be a deliberate feature,
  and it re-creates a transporter per message, so it is the wrong base.
  Flag for confirmation if per-tenant auth mail branding is actually wanted.

### Phase 7 — Frontend
- Delete `client/src/utils/keycloak.ts` (unused).
- `auth.api.ts`: add `refresh()` and `logout()`; keep the existing response interfaces, extend
  `UserProfile` only if needed.
- `axios.ts`: add a response interceptor that, on 401 with a stored refresh token, calls
  `/auth/api/refresh` once, retries, and only then logs out. Guard against refresh loops.
- `SystemHealthPage.tsx` / `SettingsPage.tsx` / `verifyEmail.tsx`: replace Keycloak copy.
- Remove `VITE_KEYCLOAK_*` from `.env` and `.env.production`.

### Phase 8 — Infra & config cleanup
- `package.json`: `npm uninstall keycloak-connect nest-keycloak-connect passport-keycloak-bearer @keycloak/keycloak-admin-client`; remove the `setup:keycloak` script; install `@nestjs/jwt`.
- Delete `scripts/setup-keycloak.{ts,js,d.ts,js.map}`.
- `docker-compose.yml`: remove the Keycloak service and the `KEYCLOAK_ADMIN*` vars.
- `render.yaml`: remove `KEYCLOAK_URL/REALM/CLIENT_ID/CLIENT_SECRET`.
- `backend/.env`: remove `KEYCLOAK_*`; add `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`.
- Seeds: replace `keycloakUserId: 'kc-*'` with `passwordHash` (bcrypt of a known dev password) and
  `requiredActions: []`, so demo logins work after the switch.
- Note: the checked-in `prisma/seed.js`, `scripts/*.js` + `.map` and `tsconfig.build.tsbuildinfo`
  are build artifacts that are tracked in git. Confirm whether they should be regenerated or
  gitignored.

---

## 5. Verification

1. `npm run build` (or `npx tsc --noEmit`) in `backend/` — no `nest-keycloak-connect` imports remain
   (`grep -rn "nest-keycloak-connect" backend/src` → empty).
2. `npx prisma migrate dev` + `npx prisma generate`; then `npm run seed` against a scratch DB.
3. `npm run test` — currently only 3 detected test files; add focused unit tests for
   `AuthService.validateCredentials`, `TokenService` refresh rotation, and `JwtAuthGuard` public-route
   handling. These are the parts where a silent regression is most likely.
4. End-to-end against the real interface, not just the build:
   - `POST /api/v1/auth/api/login` with a seeded user → access + refresh tokens.
   - `GET /api/v1/auth/api/me` with that token → 200; without it → 401.
   - `POST /api/v1/auth/api/refresh` → new tokens; replaying the old refresh token → 401 (rotation).
   - `POST /api/v1/auth/api/logout` then reusing the refresh token → 401 (revocation).
   - `POST /api/v1/auth/register` → org + admin user created atomically; duplicate email rejected.
   - `POST /api/v1/auth/invite` → local user created, invitation email sent, link works.
   - API-key path: `x-api-key` request still authenticates and `PermissionsGuard` still short-circuits.
   - A NULL-`passwordHash` user gets the forced-reset path, not a 500 (D3).
   - Two-factor: toggle on → login returns `requires2FA` + `sessionId` → `/2fa/verify` succeeds.
5. Confirm no Keycloak process is needed to boot the API (stop the docker-compose container and run
   the checks above).
6. Frontend: log in through the real login page, confirm token attach, 401→refresh→retry, and that
   logout clears state.

---

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Existing users have no portable password hash | All accounts locked out | D3: forced reset cutover + comms; seed dev passwords locally |
| `sub` semantics change | Silent mis-assignment of `orgId`, `createdBy`, roles | Do D1 in one atomic change; delete the mapping helpers rather than leaving both paths |
| Global `OrgInterceptor` overwrites `orgId` with the `default` org | Cross-tenant data leak | Remove the overwrite as part of Phase 5, before enabling JWT auth |
| `UserSyncInterceptor` creates a user per unknown `sub` | Junk users once `sub` is a local id | Delete the interceptor |
| Long-lived access tokens with no refresh | Sessions die mid-use | D2; small TTL + rotation |
| Refresh token replay | Session hijack | Rotate on every use, revoke the family on reuse |
| Two `InvitationService` implementations | Half-migrated invitations | Consolidate to one; confirm with owner |
| `keycloakUserId` still NOT NULL during rollout | `register`/invite insert failures | Make nullable in Phase 1 before any write path changes |

---

## 7. Suggested commit sequence

1. Phase 1 (schema + migration + backfill) — no behaviour change.
2. Phase 2 (JWT infra + `Public` decorator + `JwtAuthGuard`) — nothing wired yet.
3. Phase 3–4 (`AuthService`, `AuthFlowService`) — login works locally, Keycloak still present.
4. Phase 5 (guards + interceptors) — cutover point; API-key path verified.
5. Phase 6 (register/invitations/email).
6. Phase 7–8 (frontend + infra/config cleanup).
7. Follow-up PR: drop `keycloak_user_id`.

Keep step 4 as the single reversible cutover. Steps 1–3 are additive and can land with Keycloak
still configured, which keeps `main` deployable throughout.

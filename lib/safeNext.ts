/**
 * Where sign-up may send someone afterwards (`/signup?next=`): only a plain
 * path on this site. Never another host (`//host`), a scheme, or a backslash.
 */
export function safeNext(wanted: unknown): string | null {
  return typeof wanted === "string" && /^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(wanted) ? wanted : null;
}

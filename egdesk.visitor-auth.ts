/**
 * Visitor Google login defaults for this site.
 *
 * OWNED BY THIS PROJECT — EGDesk will not overwrite this file.
 * Generated helpers (egdesk-visitor-google.ts) read these defaults.
 *
 * This demo exercises Drive/Sheets after login, so the default is workspace.
 * Login-only sites should use 'basic'. Pages can still override per button.
 */
export const VISITOR_AUTH = {
  scopes: 'workspace' as 'basic' | 'workspace',
};

/**
 * Type definitions for streamdown-vue
 */

/**
 * Shiki theme configuration.
 * Can be either a single theme name or an object with light and dark themes.
 * 
 * @example
 * // Single theme
 * const theme: ShikiThemeConfig = 'github-light';
 * 
 * @example
 * // Dual theme (automatic switching via CSS)
 * const theme: ShikiThemeConfig = { light: 'github-light', dark: 'github-dark' };
 */
export type ShikiThemeConfig = string | { light: string; dark: string };

// Auth Routes
export const AUTH_ROUTES = {
  LOGIN: "Login",
} as const;

// App Routes (Bottom Tab Navigation)
export const APP_ROUTES = {
  HOME: "Home",
  SPRINT: "Sprint",
  STUDIO: "Studio",
  PROFILE: "Profile",
} as const;

// Stack Routes (modal screens)
export const STACK_ROUTES = {
  CONTENT_DETAIL: "ContentDetail",
  MODULE_QUIZ: "ModuleQuiz",
  NOTIFICATIONS: "Notifications",
} as const;

// Type exports
export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];
export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];
export type StackRoute = (typeof STACK_ROUTES)[keyof typeof STACK_ROUTES];

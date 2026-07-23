// Auth Routes
export const AUTH_ROUTES = {
  LOGIN: "Login",
} as const;

// App Routes (Bottom Tab Navigation)
export const APP_ROUTES = {
  HOME: "Home",
  CONTENT_LIBRARY: "ContentLibrary",
  SPRINTVERSE: "Sprintverse",
  PROFILE: "Profile",
} as const;

// Stack Routes (modal screens)
export const STACK_ROUTES = {
  SPRINT: "Sprint",
  STUDIO: "Studio",
  CONTENT_DETAIL: "ContentDetail",
  MODULE_QUIZ: "ModuleQuiz",
  NOTIFICATIONS: "Notifications",
  CONTENT_VIEWER: "ContentViewer",
} as const;

// Type exports
export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];
export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];
export type StackRoute = (typeof STACK_ROUTES)[keyof typeof STACK_ROUTES];

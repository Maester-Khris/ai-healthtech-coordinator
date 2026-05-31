import * as Sentry from "@sentry/react"

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "staging",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.5,
    sendDefaultPii: false,
  })
}

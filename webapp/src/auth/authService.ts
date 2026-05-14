import { supabase } from "../lib/supabaseClient"

export const authService = {
  signInWithEmail: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signUpWithEmail: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    }),

  signOut: () => supabase.auth.signOut(),

  getAccessToken: async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
}

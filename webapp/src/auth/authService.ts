// Stub — real implementation in Part 2
// All methods are no-ops until Supabase client is wired

export const authService = {
  signInWithEmail: async (_email: string, _password: string): Promise<void> => {},
  signUpWithEmail: async (_email: string, _password: string): Promise<void> => {},
  signInWithGoogle: async (): Promise<void> => {},
  signOut: async (): Promise<void> => {},
  getAccessToken: async (): Promise<string | null> => null,
}

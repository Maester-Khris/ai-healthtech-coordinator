import { useAuth } from "../../auth/AuthContext"

export function UserMenu() {
  const { user, signOut } = useAuth()

  const email = user?.email ?? ""
  const initial = email.charAt(0).toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-none">
          {initial}
        </div>
        <span className="text-sm font-medium text-gray-700 max-w-[160px] truncate">
          {email}
        </span>
      </div>
      <button
        className="px-3 py-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={signOut}
      >
        Sign out
      </button>
    </div>
  )
}

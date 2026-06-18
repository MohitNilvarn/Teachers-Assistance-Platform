import { Navigate, Outlet } from "react-router-dom"

/**
 * Check if a JWT is expired by decoding the payload.
 * Returns true if the token is expired or cannot be decoded.
 */
function isTokenExpired(token: string): boolean {
    try {
        const parts = token.split(".")
        if (parts.length !== 3) return true
        const payload = JSON.parse(atob(parts[1]))
        // exp is in seconds, Date.now() is in ms
        return !payload.exp || payload.exp * 1000 < Date.now()
    } catch {
        return true
    }
}

export const ProtectedRoute = () => {
    const token = sessionStorage.getItem("token")
    const refreshToken = sessionStorage.getItem("refresh_token")

    // If there's no token at all, redirect to login
    if (!token) {
        return <Navigate to="/login" replace />
    }

    // If the access token is expired but we have a refresh token,
    // let the page render — authFetch in api.ts will handle the refresh
    // transparently on the first API call.
    if (isTokenExpired(token) && !refreshToken) {
        // No refresh token either — session is truly dead
        sessionStorage.clear()
        return <Navigate to="/login" replace />
    }

    return <Outlet />
}

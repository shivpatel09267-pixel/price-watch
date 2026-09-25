// Shared form-validation + error-message helpers so Login, SignUp, and
// Onboarding all enforce the same rules and show the same friendly text.

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// 6 matches Firebase Auth's own server-side minimum — keeping the client
// check in sync with it avoids a confusing "your password is fine here
// but rejected on submit" mismatch.
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

export function isValidZipCode(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}

// Firebase throws errors shaped like { code: 'auth/wrong-password', message: '...' }.
// We show our own copy instead of Firebase's message — it's written for
// developers, not end users.
export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email':
      return "That email address doesn't look right.";
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

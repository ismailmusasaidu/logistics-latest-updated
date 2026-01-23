export function getUserFriendlyError(error: any): string {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';

  if (!errorMessage && !errorCode) {
    return 'Something went wrong. Please try again.';
  }

  if (errorMessage.toLowerCase().includes('invalid login credentials') ||
      errorMessage.toLowerCase().includes('invalid email or password')) {
    return 'The email or password you entered is incorrect. Please try again.';
  }

  if (errorMessage.toLowerCase().includes('email not confirmed')) {
    return 'Please verify your email address before signing in.';
  }

  if (errorMessage.toLowerCase().includes('user already registered') ||
      errorMessage.toLowerCase().includes('email already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (errorMessage.toLowerCase().includes('password') &&
      errorMessage.toLowerCase().includes('at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (errorMessage.toLowerCase().includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('fetch failed')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  if (errorMessage.toLowerCase().includes('timeout')) {
    return 'The request took too long. Please try again.';
  }

  if (errorMessage.toLowerCase().includes('insufficient funds') ||
      errorMessage.toLowerCase().includes('insufficient balance')) {
    return 'You do not have enough balance in your wallet.';
  }

  if (errorMessage.toLowerCase().includes('payment failed')) {
    return 'Payment could not be processed. Please try again.';
  }

  if (errorMessage.toLowerCase().includes('permission denied') ||
      errorMessage.toLowerCase().includes('not authorized')) {
    return 'You do not have permission to perform this action.';
  }

  if (errorMessage.toLowerCase().includes('duplicate') ||
      errorMessage.toLowerCase().includes('unique constraint')) {
    return 'This record already exists. Please use different information.';
  }

  if (errorCode === '23505') {
    return 'This record already exists. Please use different information.';
  }

  if (errorCode === '23503') {
    return 'Unable to complete operation due to related data constraints.';
  }

  if (errorMessage.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (errorMessage.toLowerCase().includes('not found')) {
    return 'The requested item could not be found.';
  }

  if (errorMessage.length > 100) {
    return 'An error occurred while processing your request. Please try again.';
  }

  return errorMessage || 'Something went wrong. Please try again.';
}

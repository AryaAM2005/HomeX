export function emailError(email) {
  if (!email.trim()) return 'Enter your email address';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address';
  return undefined;
}

export function phoneError(phone, country) {
  const compactPhone = phone.replace(/[\s()-]/g, '');
  if (!compactPhone) return 'Enter your mobile number';

  if (country === 'IN') {
    const local = compactPhone.replace(/^(\+91|0)/, '');
    return /^[6-9]\d{9}$/.test(local) ? undefined : 'Enter a valid 10-digit mobile number';
  }
  return /^\+\d{7,15}$/.test(compactPhone)
    ? undefined
    : 'Include your country code, like +1 415 555 0100';
}

export function newPasswordError(password) {
  if (password.length < 8) return 'Password must be at least 8 characters';
  return undefined;
}

// Drops the checks that passed, leaving only real errors.
export function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

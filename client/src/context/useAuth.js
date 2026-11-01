import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const ROLE_HOME = {
  customer: '/dashboard',
  caregiver: '/caregiver',
  careManager: '/care-manager',
  admin: '/admin',
};

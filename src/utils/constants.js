
import { Appearance } from 'react-native';

// new project
export const API_URL = 'https://hostel-management-system-n4kd.onrender.com/api';
export const ONBOARDING_PUBLIC_URL = 'https://nilayamhostelmanagement.in.net';

// KHPB AKKA
// export const API_URL = "https://hostelmanagment-nz5i.onrender.com/api";
// export const ONBOARDING_PUBLIC_URL = 'https://hostel-management-system-sk.netlify.app';

const lightColors = {
  primary: '#4338ca',
  primaryDark: '#1e1b4b',
  primarySoft: '#eef2ff',
  accent: '#f59e0b',
  accentSoft: '#fffbeb',
  success: '#059669',
  successSoft: '#ecfdf5',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warning: '#d97706',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  violet: '#7c3aed',
  violetSoft: '#f5f3ff',
  bg: '#f6f7fb',
  surface: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  faint: '#f8fafc',
};

const darkColors = {
  primary: '#818cf8',
  primaryDark: '#c7d2fe',
  primarySoft: '#1e2440',
  accent: '#fbbf24',
  accentSoft: '#2c2414',
  success: '#34d399',
  successSoft: '#123226',
  danger: '#f87171',
  dangerSoft: '#331b22',
  warning: '#f59e0b',
  info: '#60a5fa',
  infoSoft: '#152943',
  violet: '#a78bfa',
  violetSoft: '#251b3d',
  bg: '#0a0e1a',
  surface: '#141a2a',
  border: '#1f2738',
  text: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#1b2335',
};

export const colors = Appearance.getColorScheme() === 'dark' ? darkColors : lightColors;

export const screenPad = 16;

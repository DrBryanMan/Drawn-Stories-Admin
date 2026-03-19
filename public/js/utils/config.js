const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE = isDev
  ? `${window.location.protocol}//${window.location.hostname}:7000/api`
  : `${window.location.protocol}//${window.location.hostname}/api`;
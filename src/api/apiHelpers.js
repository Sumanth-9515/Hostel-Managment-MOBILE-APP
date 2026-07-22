import api from './client';

export const GET_TIMEOUT = 90000;
export const RETRY_DELAYS = [900, 1800];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const isTemporaryNetworkFailure = error => {
  if (error?.response) return false;
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === 'econaborted' ||
    code === 'err_network' ||
    code === 'etimedout' ||
    message.includes('network') ||
    message.includes('timeout')
  );
};

export const resilientGet = async (url, config = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    try {
      return await api.get(url, { timeout: GET_TIMEOUT, ...config });
    } catch (error) {
      lastError = error;
      if (!isTemporaryNetworkFailure(error) || attempt === RETRY_DELAYS.length) {
        throw error;
      }
      await wait(RETRY_DELAYS[attempt]);
    }
  }
  throw lastError;
};

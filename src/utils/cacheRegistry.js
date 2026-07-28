const resetters = new Set();

export const registerCacheReset = reset => {
  if (typeof reset !== 'function') return () => {};
  resetters.add(reset);
  return () => resetters.delete(reset);
};

export const clearUserCaches = () => {
  resetters.forEach(reset => {
    try {
      reset();
    } catch {
      // Cache reset should never block logout or account switching.
    }
  });
};

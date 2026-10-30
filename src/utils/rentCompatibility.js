const safeAmount = value => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export const isUpcomingRent = rent => rent?.isUpcoming === true;

export const upcomingAmountFor = rent => safeAmount(rent?.upcomingAmount);

export const accumulatedDueFor = rent => safeAmount(rent?.totalAccumulatedDue);

export const payableRemainingFor = rent => {
  const record = rent?.record || rent?.currentRecord || {};
  return safeAmount(rent?.remaining ?? (safeAmount(record.rentAmount) - safeAmount(record.paidAmount)));
};

export const currentDueFor = rent => isUpcomingRent(rent) ? 0 : payableRemainingFor(rent);

export const rentDisplayStatus = rent => {
  if (isUpcomingRent(rent)) return 'Upcoming';
  return rent?.record?.status || rent?.currentRecord?.status || rent?.status || 'Due';
};

export const revenueSummaryWithDefaults = summary => ({
  ...(summary || {}),
  upcomingRevenue: safeAmount(summary?.upcomingRevenue),
  counts: {
    ...(summary?.counts || {}),
    Upcoming: safeAmount(summary?.counts?.Upcoming),
  },
});

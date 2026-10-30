import {
  accumulatedDueFor,
  currentDueFor,
  isUpcomingRent,
  payableRemainingFor,
  rentDisplayStatus,
  revenueSummaryWithDefaults,
  upcomingAmountFor,
} from '../src/utils/rentCompatibility';

describe('rent backend compatibility', () => {
  it('defaults new upcoming fields without changing stored statuses', () => {
    expect(isUpcomingRent({ status: 'Due' })).toBe(false);
    expect(upcomingAmountFor({ status: 'Due' })).toBe(0);
    expect(rentDisplayStatus({ status: 'Partial' })).toBe('Partial');
    expect(revenueSummaryWithDefaults({ counts: { Due: 2 } })).toMatchObject({
      upcomingRevenue: 0,
      counts: { Due: 2, Upcoming: 0 },
    });
  });

  it('keeps upcoming rent separate while preserving its early-payment balance', () => {
    const rent = {
      isUpcoming: true,
      upcomingAmount: 7500,
      totalAccumulatedDue: 0,
      remaining: 7500,
      currentRecord: { status: 'Due', rentAmount: 7500, paidAmount: 0 },
    };

    expect(rentDisplayStatus(rent)).toBe('Upcoming');
    expect(upcomingAmountFor(rent)).toBe(7500);
    expect(accumulatedDueFor(rent)).toBe(0);
    expect(currentDueFor(rent)).toBe(0);
    expect(payableRemainingFor(rent)).toBe(7500);
  });

  it.each([
    ['currently due', { remaining: 5000, currentRecord: { status: 'Due' } }, 5000, 'Due'],
    ['overdue', { remaining: 5000, isOverdue: true, currentRecord: { status: 'Due' } }, 5000, 'Due'],
    ['partial', { remaining: 2000, currentRecord: { status: 'Partial' } }, 2000, 'Partial'],
    ['paid', { remaining: 0, currentRecord: { status: 'Paid' } }, 0, 'Paid'],
  ])('handles %s rent', (_label, rent, due, status) => {
    expect(currentDueFor(rent)).toBe(due);
    expect(rentDisplayStatus(rent)).toBe(status);
  });

  it('shows arrears and upcoming as independent amounts', () => {
    const rent = {
      isUpcoming: true,
      arrearsTotal: 3200,
      totalAccumulatedDue: 3200,
      upcomingAmount: 7000,
      remaining: 7000,
    };

    expect(accumulatedDueFor(rent)).toBe(3200);
    expect(upcomingAmountFor(rent)).toBe(7000);
  });

  it('does not mix advance pending into rent balances', () => {
    const rent = { totalAccumulatedDue: 0, remaining: 0, pendingAdvanceAmount: 4500 };
    expect(accumulatedDueFor(rent)).toBe(0);
    expect(currentDueFor(rent)).toBe(0);
    expect(payableRemainingFor(rent)).toBe(0);
  });
});

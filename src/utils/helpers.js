export const getMessage = error =>
  error?.response?.data?.message || error?.message || 'Something went wrong.';

export const money = value =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const dateText = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const compactLocation = tenant => {
  const info = tenant?.allocationInfo;
  if (!info?.buildingName) return 'Unallocated';
  return `${info.buildingName} / F${info.floorNumber} / R${info.roomNumber} / B${info.bedNumber}`;
};

export const advancePendingFor = item => {
  const tenant = item?.tenant || {};
  const expected = Number(item?.advanceAmount ?? tenant.advanceAmount ?? 0);
  const paid = Number(item?.paidAdvanceAmount ?? tenant.paidAdvanceAmount ?? item?.paidadvanceAmount ?? tenant.paidadvanceAmount ?? 0);
  return Math.max(0, Number(item?.pendingAdvanceAmount ?? tenant.pendingAdvanceAmount ?? item?.advancePending ?? tenant.advancePending ?? expected - paid));
};

// Merge advance fields from /rent/all into /rent/due items so cards can show
// advance badges and offer advance payment (mirrors the website behaviour).
export const mergeAdvanceIntoDueItems = (items = [], rentAll = []) => {
  if (!Array.isArray(items) || !Array.isArray(rentAll) || rentAll.length === 0) return items;
  const map = new Map();
  rentAll.forEach(entry => {
    const id = entry?.tenant?._id;
    if (id) map.set(String(id), entry);
  });
  return items.map(item => {
    const id = item?.tenant?._id ? String(item.tenant._id) : null;
    const info = id ? map.get(id) : null;
    if (!info) return item;
    const advanceAmount = Number(item.advanceAmount ?? item.tenant?.advanceAmount ?? info.advanceAmount ?? info.tenant?.advanceAmount ?? 0);
    const paidAdvanceAmount = Number(
      item.paidAdvanceAmount ??
      item.tenant?.paidAdvanceAmount ??
      info.paidAdvanceAmount ??
      info.tenant?.paidAdvanceAmount ??
      item.paidadvanceAmount ??
      item.tenant?.paidadvanceAmount ??
      info.paidadvanceAmount ??
      info.tenant?.paidadvanceAmount ??
      0
    );
    const pendingAdvanceAmount = Math.max(0, Number(
      item.pendingAdvanceAmount ??
      item.tenant?.pendingAdvanceAmount ??
      info.pendingAdvanceAmount ??
      info.tenant?.pendingAdvanceAmount ??
      item.advancePending ??
      item.tenant?.advancePending ??
      info.advancePending ??
      info.tenant?.advancePending ??
      advanceAmount - paidAdvanceAmount
    ));
    return {
      ...item,
      advanceAmount,
      paidAdvanceAmount,
      pendingAdvanceAmount,
      paidadvanceAmount: paidAdvanceAmount,
      advancePending: pendingAdvanceAmount,
      tenant: {
        ...item.tenant,
        advanceAmount,
        paidAdvanceAmount,
        pendingAdvanceAmount,
        paidadvanceAmount: paidAdvanceAmount,
        advancePending: pendingAdvanceAmount,
      },
    };
  });
};

export const pickArray = payload => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.logs)) return payload.logs;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.tenants)) return payload.tenants;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

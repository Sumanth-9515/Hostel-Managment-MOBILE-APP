import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmailReminderButton from '../../components/EmailReminderButton';
import EmptyState from '../../components/EmptyState';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import ProfileImagePopup from '../../components/ProfileImagePopup';
import { DetailSkeleton } from '../../components/Skeleton';
import { useSidebar } from '../../components/Sidebar';
import { rentApi } from '../../api/rentApi';
import { colors } from '../../utils/constants';
import { advancePendingFor, compactLocation, dateText, getMessage, mergeAdvanceIntoDueItems, money } from '../../utils/helpers';

const PAGE_LIMIT = 15;
const FILTER_PAGE_LIMIT = 200;

const rentScreenCache = {
  hasData: false,
  items: [],
  allItems: [],
  stats: {},
  page: 1,
  totalPages: 1,
};

const PAYMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'previous_overdues', label: 'Previous overdues' },
  { value: 'advance_pending', label: 'Advance pending' },
  { value: 'current_month_dues', label: 'Current dues' },
  { value: 'upcoming_dues', label: 'Upcoming dues' },
];

const monthText = value => value
  ? new Date(value).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  : 'Current month';

const statusTone = {
  Paid: { fg: colors.success, bg: colors.successSoft },
  Partial: { fg: colors.warning, bg: colors.accentSoft },
  Due: { fg: colors.danger, bg: colors.dangerSoft },
};

const remainingOf = item => Number(item?.remaining ?? ((item?.record?.rentAmount || item?.currentRecord?.rentAmount || 0) - (item?.record?.paidAmount || item?.currentRecord?.paidAmount || 0)));
const dueValueOf = item => Number(item?.totalAccumulatedDue ?? item?.remaining ?? 0);
const duePriorityOf = item => {
  const remaining = remainingOf(item);
  const hasPreviousDue = item?.hasPreviousPending || (item?.pendingMonths || []).some(pm => (pm.rentAmount || 0) - (pm.paidAmount || 0) > 0);
  if (hasPreviousDue) return 0;
  if (remaining > 0 && (item?.isOverdue || item?.daysUntilDue === 0)) return 1;
  if (remaining > 0 && item?.daysUntilDue != null && item.daysUntilDue > 0) return 2;
  return 3;
};

const buildPayable = item => {
  const options = [];
  (item?.pendingMonths || []).forEach(record => {
    const remaining = Number(record.rentAmount || 0) - Number(record.paidAmount || 0);
    if (remaining > 0) options.push({
      key: `rent:${record.monthYear}`,
      type: 'rent',
      monthYear: record.monthYear,
      maxAmount: remaining,
      label: `${monthText(record.dueDate)} (Arrears)`,
    });
  });
  const record = item?.record || item?.currentRecord;
  const currentRemaining = Number(item?.remaining ?? ((record?.rentAmount || 0) - (record?.paidAmount || 0)));
  if (record?.monthYear && currentRemaining > 0 && !options.some(option => option.monthYear === record.monthYear)) {
    options.push({ key: `rent:${record.monthYear}`, type: 'rent', monthYear: record.monthYear, maxAmount: currentRemaining, label: `${monthText(record.dueDate)} (Current)` });
  }
  const advancePending = advancePendingFor(item);
  if (advancePending > 0) options.push({ key: 'advance', type: 'advance', monthYear: null, maxAmount: advancePending, label: 'Advance Amount' });
  return options;
};

const buildWAMessage = item => {
  const { tenant, record, totalAccumulatedDue, pendingMonths = [], isOverdue, daysOverdue } = item;
  const month = record ? new Date(record.dueDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : 'this month';
  let m = `Hello ${tenant?.name || 'there'},\n\n`;
  if (pendingMonths.length > 0) {
    m += `You have ${pendingMonths.length} month(s) of unpaid rent.\n`;
  } else if (isOverdue) {
    m += `Your rent for ${month} is overdue by ${daysOverdue || 0} day(s).\n`;
  } else {
    m += `This is a friendly reminder for your rent of ${month}.\n`;
  }
  m += `\nTotal Due: Rs. ${Number(totalAccumulatedDue || 0).toLocaleString('en-IN')}\n`;
  if (tenant?.allocationInfo?.roomNumber) m += `Room: ${tenant.allocationInfo.roomNumber}\n`;
  m += `\nPlease clear your dues at the earliest.\nThank you.`;
  return encodeURIComponent(m);
};

function OverviewMetric({ label, value, color, last }) {
  return (
    <View style={[styles.overviewMetric, !last && styles.overviewMetricDivider]}>
      <Text style={styles.overviewMetricLabel} numberOfLines={2}>{label}</Text>
      <Text style={[styles.overviewMetricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62}>{value}</Text>
    </View>
  );
}

function SummaryPanel({ label, value, message, color, last }) {
  return (
    <View style={[styles.summaryPanel, !last && styles.summaryPanelDivider]}>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{value}</Text>
      <Text style={styles.summaryMessage} numberOfLines={2}>{message}</Text>
    </View>
  );
}

function DuesOverview({ overview }) {
  return (
    <View style={styles.overviewCard}>
      <View style={styles.overviewTitleRow}>
        <View style={[styles.titleIcon, { backgroundColor: colors.violetSoft }]}>
          <Icon name="calendar-month-outline" size={18} color={colors.violet} />
        </View>
        <Text style={styles.overviewTitle}>Dues Overview</Text>
      </View>
      <View style={styles.overviewTop}>
        <OverviewMetric label="Previous Month Dues" value={overview.previous} color={colors.warning} />
        <OverviewMetric label="This Month Dues" value={overview.current} color={colors.info} />
        <OverviewMetric label="Upcoming Dues" value={overview.upcoming} color={colors.success} last />
      </View>
      <View style={styles.summaryRow}>
        <SummaryPanel
          label="Pending Amount"
          value={money(overview.pendingAmount)}
          message="Total amount pending from tenants"
          color={colors.warning}
        />
        <SummaryPanel
          label="Total Alerts"
          value={overview.totalAlerts}
          message="Total active alerts across all categories"
          color={colors.primaryDark}
          last
        />
      </View>
    </View>
  );
}

function RentDataSkeleton() {
  return (
    <View style={styles.skeletonList} pointerEvents="none">
      {[0, 1, 2].map(index => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.top}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.flex}>
              <View style={[styles.skeletonLine, styles.skeletonName]} />
              <View style={[styles.skeletonLine, styles.skeletonPhone]} />
            </View>
            <View style={styles.skeletonBadge} />
          </View>
          <View style={[styles.skeletonLine, styles.skeletonLocation]} />
          <View style={styles.dueRow}>
            <View style={styles.skeletonAmountBlock}>
              <View style={[styles.skeletonLine, styles.skeletonLabel]} />
              <View style={[styles.skeletonLine, styles.skeletonAmount]} />
            </View>
            <View style={[styles.skeletonLine, styles.skeletonDueDate]} />
          </View>
          <View style={styles.iconRow}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonPayBtn} />
          </View>
        </View>
      ))}
    </View>
  );
}

function StatusPill({ status }) {
  if (!status) return null;
  const tone = statusTone[status] || statusTone.Due;
  return <Text style={[styles.pill, { color: tone.fg, backgroundColor: tone.bg }]}>{status}</Text>;
}

function AdvanceBadge({ expected = 0, paid = 0 }) {
  const pending = Math.max(0, Number(expected || 0) - Number(paid || 0));
  if (Number(expected || 0) <= 0) return null;
  const isPaid = pending <= 0;
  return (
    <View style={[styles.advBadge, isPaid ? styles.advPaid : styles.advPending]}>
      <Icon name="cash-multiple" size={12} color={isPaid ? colors.success : colors.warning} />
      <Text style={[styles.advText, { color: isPaid ? colors.success : colors.warning }]}>
        {isPaid ? `Adv paid ${money(paid)}` : `Adv due ${money(pending)}`}
      </Text>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailRow}>
      <Icon name={icon} size={18} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

// ── Edit-payment (correction) modal ──
function EditPaymentModal({ record, onClose, onSave }) {
  const [paidAmount, setPaidAmount] = useState(String(record?.paidAmount ?? 0));
  const [note, setNote] = useState('Corrected payment record');
  const [loading, setLoading] = useState(false);
  const rentAmount = Number(record?.rentAmount || 0);

  const save = async () => {
    const value = Number(paidAmount);
    if (!Number.isFinite(value) || value < 0) return Alert.alert('Invalid amount', 'Enter a valid paid amount.');
    if (value > rentAmount) return Alert.alert('Amount too high', `Paid amount cannot exceed rent of ${money(rentAmount)}.`);
    setLoading(true);
    try {
      await onSave({ recordId: record._id || record.id, rentAmount, paidAmount: value, note });
    } catch (error) {
      Alert.alert('Correction failed', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoid modal style={styles.centerBackdrop}>
        <View style={styles.centerModal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Edit Payment</Text>
            <Pressable onPress={onClose}><Icon name="close" size={22} color={colors.muted} /></Pressable>
          </View>
          <Text style={styles.muted}>{monthText(record?.dueDate)}</Text>
          <View style={styles.editTwoCol}>
            <View style={styles.miniBox}><Text style={styles.miniLabel}>Rent</Text><Text style={styles.miniValue}>{money(rentAmount)}</Text></View>
            <View style={styles.miniBox}><Text style={styles.miniLabel}>Current paid</Text><Text style={[styles.miniValue, { color: colors.success }]}>{money(record?.paidAmount || 0)}</Text></View>
          </View>
          <AppInput label="Correct Paid Amount" value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" />
          <AppInput label="Note" value={note} onChangeText={setNote} />
          <AppButton title="Save Correction" icon="check" loading={loading} onPress={save} />
        </View>
      </KeyboardAvoid>
    </Modal>
  );
}

// ── Payment-status filter (segmented chips) ──
function PaymentStatusFilter({ value, onChange }) {
  return (
    <View style={styles.filterCard}>
      <Text style={styles.filterTitle}>Payment status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PAYMENT_STATUS_OPTIONS.map(option => {
          const active = value === option.value;
          return (
            <Pressable key={option.value} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onChange(option.value)}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Location filter (cascading building → floor → room) ──
function LocationFilter({ items, value, onChange }) {
  const buildings = useMemo(() => Array.from(new Set(
    items.map(i => i.tenant?.allocationInfo?.buildingName).filter(Boolean),
  )).sort((a, b) => String(a).localeCompare(String(b))), [items]);

  const floors = useMemo(() => value.building ? Array.from(new Set(
    items.filter(i => i.tenant?.allocationInfo?.buildingName === value.building && i.tenant?.allocationInfo?.floorNumber != null)
      .map(i => i.tenant.allocationInfo.floorNumber),
  )).sort((a, b) => a - b) : [], [items, value.building]);

  const rooms = useMemo(() => (value.building && value.floor !== '') ? Array.from(new Set(
    items.filter(i => i.tenant?.allocationInfo?.buildingName === value.building && String(i.tenant?.allocationInfo?.floorNumber) === String(value.floor) && i.tenant?.allocationInfo?.roomNumber != null)
      .map(i => i.tenant.allocationInfo.roomNumber),
  )).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })) : [], [items, value.building, value.floor]);

  const hasFilter = value.building || value.floor !== '' || value.room;
  if (!buildings.length) return null;

  return (
    <View style={styles.filterCard}>
      <View style={styles.filterHeadRow}>
        <Text style={styles.filterTitle}>Filter by Building</Text>
        {hasFilter ? (
          <Pressable onPress={() => onChange({ building: '', floor: '', room: '' })} style={styles.clearBtn}>
            <Icon name="close" size={12} color={colors.danger} />
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {buildings.map(name => {
          const active = value.building === name;
          return (
            <Pressable key={name} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onChange(active ? { building: '', floor: '', room: '' } : { building: name, floor: '', room: '' })}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>🏢 {name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {value.building && floors.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {floors.map(floor => {
            const active = String(value.floor) === String(floor);
            return (
              <Pressable key={floor} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onChange({ building: value.building, floor: active ? '' : floor, room: '' })}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>Floor {floor}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {value.building && value.floor !== '' && rooms.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {rooms.map(room => {
            const active = String(value.room) === String(room);
            return (
              <Pressable key={room} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => onChange({ building: value.building, floor: value.floor, room: active ? '' : room })}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>Room {room}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function RentManagementScreen({ navigation, route, onLogout }) {
  const { open } = useSidebar();
  const [dataLoading, setDataLoading] = useState(!rentScreenCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [items, setItems] = useState(rentScreenCache.items);
  const [allItems, setAllItems] = useState(rentScreenCache.allItems);
  const [stats, setStats] = useState(rentScreenCache.stats);
  const [page, setPage] = useState(rentScreenCache.page);
  const [totalPages, setTotalPages] = useState(rentScreenCache.totalPages);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [locationFilter, setLocationFilter] = useState({ building: '', floor: '', room: '' });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');

  const [paying, setPaying] = useState(null);
  const [payOptions, setPayOptions] = useState([]);
  const [selectedPaymentKey, setSelectedPaymentKey] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profilePopup, setProfilePopup] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  const rentAllRef = useRef([]);
  const hasLoadedRef = useRef(rentScreenCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (pageNum = 1, append = false, options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (append) {
      setLoadingMore(true);
    } else if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [data, rentAll] = await Promise.all([
        rentApi.due({ page: pageNum, limit: PAGE_LIMIT }),
        rentApi.all().catch(() => []),
      ]);
      if (requestId !== loadRequestRef.current) return false;
      rentAllRef.current = Array.isArray(rentAll) ? rentAll : [];
      const merged = mergeAdvanceIntoDueItems(data.data || [], rentAllRef.current);
      setItems(prev => {
        const nextItems = append ? [...prev, ...merged] : merged;
        rentScreenCache.items = nextItems;
        return nextItems;
      });
      const nextStats = data.stats || {};
      const nextPage = data.page || pageNum;
      const nextTotalPages = data.totalPages || 1;
      rentScreenCache.hasData = true;
      rentScreenCache.stats = nextStats;
      rentScreenCache.page = nextPage;
      rentScreenCache.totalPages = nextTotalPages;
      setStats(nextStats);
      setPage(nextPage);
      setTotalPages(nextTotalPages);
      return true;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
      return false;
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const fetchAllDue = useCallback(async () => {
    try {
      const first = await rentApi.due({ page: 1, limit: FILTER_PAGE_LIMIT });
      const pages = first.totalPages || 1;
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2)
          .map(p => rentApi.due({ page: p, limit: FILTER_PAGE_LIMIT }).then(r => r.data || []).catch(() => [])),
      );
      const nextAllItems = mergeAdvanceIntoDueItems([...(first.data || []), ...rest.flat()], rentAllRef.current);
      rentScreenCache.allItems = nextAllItems;
      setAllItems(nextAllItems);
    } catch {
      if (!rentScreenCache.hasData) setAllItems([]);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load(1, false, { background: hasLoadedRef.current || rentScreenCache.hasData })
      .then(success => {
        if (success) hasLoadedRef.current = true;
        return success ? fetchAllDue() : null;
      });
  }, [load, fetchAllDue]));

  // Silent, in-place refresh after a payment/correction — never flips the
  // full-screen loader, keeps the current page set, and only refetches the
  // filter/search source when one is active.
  const refreshData = async () => {
    try {
      const limit = PAGE_LIMIT * Math.max(1, page);
      const [data, rentAll] = await Promise.all([
        rentApi.due({ page: 1, limit }),
        rentApi.all().catch(() => []),
      ]);
      rentAllRef.current = Array.isArray(rentAll) ? rentAll : [];
      const nextItems = mergeAdvanceIntoDueItems(data.data || [], rentAllRef.current);
      const nextStats = data.stats || {};
      const nextTotalPages = data.total ? Math.ceil(data.total / PAGE_LIMIT) || 1 : 1;
      rentScreenCache.hasData = true;
      rentScreenCache.items = nextItems;
      rentScreenCache.stats = nextStats;
      rentScreenCache.totalPages = nextTotalPages;
      setItems(nextItems);
      setStats(nextStats);
      setTotalPages(nextTotalPages);
    } catch {}
    if (isFilterMode) fetchAllDue();
    if (searchResults !== null && q.trim()) {
      rentApi.dueSearch(q.trim())
        .then(res => setSearchResults(mergeAdvanceIntoDueItems(Array.isArray(res) ? res : [], rentAllRef.current)))
        .catch(() => {});
    }
  };

  const runSearch = text => {
    setQ(text);
    if (!text.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    rentApi.dueSearch(text.trim())
      .then(res => setSearchResults(mergeAdvanceIntoDueItems(Array.isArray(res) ? res : [], rentAllRef.current)))
      .catch(error => { setSearchResults([]); Alert.alert('Search failed', getMessage(error)); })
      .finally(() => setSearchLoading(false));
  };

  // When opened from an activity log (or elsewhere) with a search term, pre-fill
  // and run the tenant search so only that tenant is shown.
  useEffect(() => {
    const incoming = route?.params?.search;
    if (incoming) {
      runSearch(incoming);
      navigation.setParams({ search: undefined });
    }
  }, [route?.params?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPay = (item, preferredMonthYear) => {
    const options = buildPayable(item);
    if (!options.length) {
      Alert.alert('Nothing to pay', 'This tenant has no pending rent or advance.');
      return;
    }
    const preferredKey = preferredMonthYear ? `rent:${preferredMonthYear}` : options[0].key;
    const selected = options.find(option => option.key === preferredKey) || options[0];
    setDetailId(null);
    setPaying(item);
    setPayOptions(options);
    setSelectedPaymentKey(selected.key);
    setAmount(String(selected.maxAmount));
    setNote('');
  };

  const choosePayment = option => {
    setSelectedPaymentKey(option.key);
    setAmount(String(option.maxAmount));
  };

  const openDetail = async item => {
    const tenantId = item?.tenant?._id;
    if (!tenantId) return;
    setDetailId(tenantId);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await rentApi.tenant(tenantId));
    } catch (error) {
      setDetailId(null);
      Alert.alert('Tenant details', getMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const pay = async () => {
    const selected = payOptions.find(option => option.key === selectedPaymentKey);
    const value = Number(amount);
    if (!paying?.tenant?._id || !selected || !value || value <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid payment amount.');
      return;
    }
    if (value > selected.maxAmount) {
      Alert.alert('Amount too high', `Payment cannot exceed ${money(selected.maxAmount)} for the selected ${selected.type === 'advance' ? 'advance' : 'month'}.`);
      return;
    }
    setSaving(true);
    try {
      await rentApi.pay({
        tenantId: paying.tenant._id,
        amount: value,
        note,
        monthYear: selected.type === 'advance' ? 'advance' : selected.monthYear,
        paymentType: selected.type,
        paymentKey: selected.key,
      });
      setPaying(null);
      setDetailId(null);
      // Update data in the background — no full-screen reload.
      await refreshData();
    } catch (error) {
      Alert.alert('Payment failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const correctPayment = async payload => {
    if (!detailId) return;
    await rentApi.paymentCorrection(payload);
    setEditingPayment(null);
    try { setDetail(await rentApi.tenant(detailId)); } catch {}
    await refreshData();
  };

  const whatsapp = item => {
    const phone = item.tenant?.phone?.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/91${phone}?text=${buildWAMessage(item)}`).catch(() => Alert.alert('WhatsApp', 'Unable to open WhatsApp.'));
  };

  const call = item => Linking.openURL(`tel:${item.tenant?.phone}`).catch(() => {});

  // ── Derived filtered list ──
  const isSearchMode = searchResults !== null;
  const isLocationFilter = !!(locationFilter.building || locationFilter.floor !== '' || locationFilter.room);
  const isFilterMode = isLocationFilter || paymentStatusFilter !== 'all';

  const applyLocation = list => {
    if (!isLocationFilter) return list;
    const { building, floor, room } = locationFilter;
    return list.filter(item => {
      const alloc = item.tenant?.allocationInfo || {};
      if (building && alloc.buildingName !== building) return false;
      if (floor !== '' && String(alloc.floorNumber) !== String(floor)) return false;
      if (room && String(alloc.roomNumber) !== String(room)) return false;
      return true;
    });
  };

  const applyPaymentStatus = list => {
    if (paymentStatusFilter === 'all') return list;
    return list.filter(item => {
      const remaining = remainingOf(item);
      switch (paymentStatusFilter) {
        case 'previous_overdues':
          return !!item.hasPreviousPending || (item.pendingMonths || []).some(pm => (pm.rentAmount || 0) - (pm.paidAmount || 0) > 0);
        case 'advance_pending':
          return advancePendingFor(item) > 0;
        case 'current_month_dues':
          return remaining > 0 && (item.isOverdue || item.daysUntilDue === 0);
        case 'upcoming_dues':
          return remaining > 0 && item.daysUntilDue != null && item.daysUntilDue > 0;
        default:
          return true;
      }
    });
  };

  const filterSource = isSearchMode ? (searchResults || []) : allItems;
  const baseItems = isSearchMode ? (searchResults || []) : isFilterMode ? allItems : items;
  const displayItems = [...applyPaymentStatus(applyLocation(baseItems))]
    .sort((a, b) => {
      const priority = duePriorityOf(a) - duePriorityOf(b);
      if (priority !== 0) return priority;
      return dueValueOf(b) - dueValueOf(a);
    });
  const overviewSource = allItems.length ? allItems : items;
  const duesOverview = {
    previous: Number(stats.totalOverdueOrCarryForward ?? overviewSource.filter(item => (
      item.hasPreviousPending || (item.pendingMonths || []).some(pm => (pm.rentAmount || 0) - (pm.paidAmount || 0) > 0)
    )).length),
    current: overviewSource.filter(item => {
      const remaining = remainingOf(item);
      return remaining > 0 && (item.isOverdue || item.daysUntilDue === 0);
    }).length,
    upcoming: Number(stats.totalDueSoon ?? overviewSource.filter(item => {
      const remaining = remainingOf(item);
      return remaining > 0 && item.daysUntilDue != null && item.daysUntilDue > 0;
    }).length),
    pendingAmount: Number(stats.totalPendingAmount ?? overviewSource.reduce((sum, item) => sum + dueValueOf(item), 0)),
    totalAlerts: Number(stats.totalAlerts ?? overviewSource.length),
  };
  const hasVisibleItems = displayItems.length > 0;
  const showRentSkeleton = dataLoading && !hasVisibleItems && !isSearchMode;
  const showRentError = !!dataError && !dataLoading && !hasVisibleItems && !isSearchMode;
  const listData = showRentSkeleton
    ? [{ __rentState: 'loading' }]
    : showRentError
      ? [{ __rentState: 'error' }]
      : displayItems;

  const renderItem = ({ item }) => {
    if (item.__rentState === 'loading') return <RentDataSkeleton />;
    if (item.__rentState === 'error') {
      return (
        <EmptyState
          title="Unable to load rent data"
          message={dataError}
          icon="wifi-alert"
        />
      );
    }

    const record = item.record || item.currentRecord;
    const remaining = remainingOf(item);
    const advancePending = advancePendingFor(item);
    const advanceOnly = advancePending > 0 && !item.hasPreviousPending && remaining <= 0;
    const overdue = !advanceOnly && (item.hasPreviousPending || item.isOverdue);
    const photo = item.tenant?.documents?.passportPhoto;
    const advanceExpected = Number(item.advanceAmount ?? item.tenant?.advanceAmount ?? 0);
    return (
      <Pressable onPress={() => openDetail(item)} accessibilityRole="button" accessibilityLabel={`View rent details for ${item.tenant?.name}`}>
        <AppCard style={overdue ? styles.cardOverdue : null}>
          <View style={styles.top}>
            <Pressable
              disabled={!photo}
              onPress={event => { event.stopPropagation(); if (photo) setProfilePopup({ imageUrl: photo, name: item.tenant?.name }); }}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.cardAvatar} />
              ) : (
                <View style={[styles.cardAvatar, styles.cardAvatarFallback]}>
                  <Text style={styles.cardAvatarText}>{item.tenant?.name?.[0]?.toUpperCase() || 'T'}</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>{item.tenant?.name}</Text>
              <Text style={styles.muted}>{item.tenant?.phone}</Text>
            </View>
            {advanceOnly ? (
              <Text style={styles.badgeSoon}>Adv pending</Text>
            ) : item.hasPreviousPending ? (
              <Text style={styles.badgeOverdue}>{item.pendingMonthsCount || ''} Overdue</Text>
            ) : item.isOverdue ? (
              <Text style={styles.badgeOverdue}>{item.daysOverdue}d overdue</Text>
            ) : item.daysUntilDue != null ? (
              <Text style={styles.badgeSoon}>Due {item.daysUntilDue === 0 ? 'today' : `${item.daysUntilDue}d`}</Text>
            ) : null}
          </View>

          <Text style={styles.location}>{compactLocation(item.tenant)}</Text>

          <View style={styles.dueRow}>
            <View>
              <Text style={styles.dueLabel}>Total accumulated due</Text>
              <Text style={[styles.due, overdue && { color: colors.danger }]}>{money(item.totalAccumulatedDue || item.remaining || 0)}</Text>
              {advanceExpected > 0 ? (
                <View style={styles.advanceBelowDue}>
                  <AdvanceBadge expected={advanceExpected} paid={item.paidAdvanceAmount ?? item.tenant?.paidAdvanceAmount ?? item.paidadvanceAmount ?? item.tenant?.paidadvanceAmount} />
                </View>
              ) : null}
            </View>
            <Text style={styles.muted}>Due {dateText(item.dueDate || record?.dueDate)}</Text>
          </View>

          <View style={styles.iconRow}>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.successSoft }]} onPress={event => { event.stopPropagation(); whatsapp(item); }}>
              <Icon name="whatsapp" size={18} color={colors.success} />
            </Pressable>
            <Pressable style={[styles.iconBtn, { backgroundColor: colors.infoSoft }]} onPress={event => { event.stopPropagation(); call(item); }}>
              <Icon name="phone" size={18} color={colors.info} />
            </Pressable>
            <EmailReminderButton tenantId={item.tenant?._id} compact hasPreviousPending={item.hasPreviousPending} advanceOnly={advanceOnly} />
            <Pressable style={styles.payBtn} onPress={event => { event.stopPropagation(); openPay(item); }}>
              <Icon name="cash-plus" size={17} color="#fff" />
              <Text style={styles.payText}>{advanceOnly ? 'Pay Advance' : overdue ? 'Pay Dues' : 'Pay Now'}</Text>
            </Pressable>
          </View>
        </AppCard>
      </Pressable>
    );
  };

  const detailTenant = detail?.tenant;
  const detailRemaining = Number(detail?.remaining ?? ((detail?.currentRecord?.rentAmount || 0) - (detail?.currentRecord?.paidAmount || 0)));
  const detailAdvancePending = advancePendingFor({ ...detail, tenant: detailTenant });

  return (
    <View style={styles.screen}>
      <AppHeader title="Rent Payments" subtitle={`${stats.totalAlerts || 0} alerts`} onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      <FlatList
        data={listData}
        keyExtractor={(item, i) => item.__rentState || `${item.tenant?._id}-${item.record?.monthYear || item.dueDate || i}`}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <>
            <DuesOverview overview={duesOverview} />
            <AppInput label="Search tenant by name" value={q} onChangeText={runSearch} />
            {searchLoading ? <Text style={styles.muted}>Searching…</Text> : null}
            <PaymentStatusFilter value={paymentStatusFilter} onChange={setPaymentStatusFilter} />
            <LocationFilter items={filterSource} value={locationFilter} onChange={setLocationFilter} />
            {isFilterMode && !isSearchMode ? (
              <Text style={styles.filterCount}>{displayItems.length} tenant{displayItems.length !== 1 ? 's' : ''} match the filter (from all pages)</Text>
            ) : null}
          </>
        )}
        ListEmptyComponent={(
          <EmptyState
            title={isFilterMode || isSearchMode ? 'No matching tenants' : 'No rent alerts'}
            message={isFilterMode || isSearchMode ? 'Try a different filter or search.' : 'All clear — no dues right now.'}
            icon="check-circle-outline"
          />
        )}
        renderItem={renderItem}
        ListFooterComponent={
          !showRentSkeleton && !showRentError && !isSearchMode && !isFilterMode && page < totalPages ? (
            <AppButton title="Load More" icon="chevron-down" variant="secondary" style={styles.more} loading={loadingMore} onPress={() => load(page + 1, true)} />
          ) : <View style={styles.footerSpacer} />
        }
      />

      {/* ── Tenant rent detail ── */}
      <Modal visible={!!detailId} transparent animationType="slide" onRequestClose={() => setDetailId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, styles.detailModal]}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Tenant Rent Details</Text>
                <Text style={styles.muted}>Complete dues and payment history</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setDetailId(null)}><Icon name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            {detailLoading ? <DetailSkeleton /> : detail ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
                <View style={styles.tenantHero}>
                  <Pressable
                    disabled={!detailTenant?.documents?.passportPhoto}
                    onPress={() => detailTenant?.documents?.passportPhoto && setProfilePopup({ imageUrl: detailTenant.documents.passportPhoto, name: detailTenant?.name })}>
                    {detailTenant?.documents?.passportPhoto ? (
                      <Image source={{ uri: detailTenant.documents.passportPhoto }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatar}><Text style={styles.avatarText}>{detailTenant?.name?.[0]?.toUpperCase() || 'T'}</Text></View>
                    )}
                  </Pressable>
                  <View style={styles.flex}>
                    <Text style={styles.detailName}>{detailTenant?.name}</Text>
                    <Text style={styles.muted}>{detailTenant?.email || 'No email on record'}</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.fullDetailsBtn}
                  onPress={() => { const id = detailId; setDetailId(null); navigation.navigate('TenantDetails', { tenantId: id }); }}>
                  <View style={styles.fullDetailsIcon}><Icon name="account-details-outline" size={18} color={colors.primary} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.fullDetailsTitle}>View Full Details</Text>
                    <Text style={styles.fullDetailsSub}>Profile, documents, edit & vacate</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>

                <View style={styles.detailActions}>
                  <Pressable style={[styles.actionPill, { backgroundColor: colors.successSoft }]} onPress={() => whatsapp({ ...detail, tenant: detailTenant, record: detail.currentRecord })}>
                    <Icon name="whatsapp" size={16} color={colors.success} />
                    <Text style={[styles.actionPillText, { color: colors.success }]}>WhatsApp</Text>
                  </Pressable>
                  <Pressable style={[styles.actionPill, { backgroundColor: colors.infoSoft }]} onPress={() => Linking.openURL(`tel:${detailTenant?.phone}`).catch(() => {})}>
                    <Icon name="phone" size={16} color={colors.info} />
                    <Text style={[styles.actionPillText, { color: colors.info }]}>Call</Text>
                  </Pressable>
                  <EmailReminderButton
                    tenantId={detailTenant?._id}
                    hasPreviousPending={detail.hasPreviousPending}
                    advanceOnly={detailAdvancePending > 0 && !detail.hasPreviousPending && detailRemaining <= 0}
                    style={styles.actionPill}
                  />
                </View>

                <View style={styles.detailGrid}>
                  <DetailRow icon="phone-outline" label="Phone" value={detailTenant?.phone} />
                  <DetailRow icon="office-building-outline" label="Hostel" value={detail.buildingDetails?.buildingName || detailTenant?.allocationInfo?.buildingName} />
                  <DetailRow icon="door-open" label="Room / Bed" value={[detail.buildingDetails?.roomNumber || detailTenant?.allocationInfo?.roomNumber, detail.buildingDetails?.bedNumber || detailTenant?.allocationInfo?.bedNumber].filter(Boolean).join(' / ')} />
                  <DetailRow icon="calendar-account" label="Joining Date" value={dateText(detailTenant?.joiningDate)} />
                </View>

                <View style={styles.totalBox}>
                  <Text style={styles.dueLabel}>Total accumulated due</Text>
                  <Text style={styles.detailTotal}>{money(detail.totalAccumulatedDue || 0)}</Text>
                  {Number(detail.arrearsTotal || 0) > 0 ? <Text style={styles.arrearsText}>{money(detail.arrearsTotal)} from previous months</Text> : null}
                </View>

                {Number(detailTenant?.advanceAmount || 0) > 0 ? (
                  <View style={styles.advanceBox}>
                    <View style={styles.flex}>
                      <Text style={styles.dueLabel}>Advance</Text>
                      <Text style={styles.advanceValue}>{money(detailTenant?.paidAdvanceAmount ?? detailTenant?.paidadvanceAmount ?? 0)} paid of {money(detailTenant?.advanceAmount || 0)}</Text>
                    </View>
                    {detailAdvancePending > 0 ? (
                      <Pressable style={styles.smallPay} onPress={() => openPay({ ...detail, tenant: detailTenant, record: detail.currentRecord })}>
                        <Text style={styles.smallPayText}>Pay {money(detailAdvancePending)}</Text>
                      </Pressable>
                    ) : <Text style={[styles.pill, { color: colors.success, backgroundColor: colors.successSoft }]}>Cleared</Text>}
                  </View>
                ) : null}

                {(detail.pendingMonths || []).length > 0 ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Pending Months</Text>
                    {detail.pendingMonths.map(month => (
                      <View style={styles.monthRow} key={month.monthYear}>
                        <View style={styles.flex}>
                          <Text style={styles.monthName}>{monthText(month.dueDate)}</Text>
                          <Text style={styles.muted}>Paid {money(month.paidAmount || 0)} of {money(month.rentAmount || 0)}</Text>
                        </View>
                        <StatusPill status={month.status} />
                        <Text style={styles.monthDue}>{money(Number(month.rentAmount || 0) - Number(month.paidAmount || 0))}</Text>
                        <Pressable style={styles.smallPay} onPress={() => openPay({ ...detail, tenant: detailTenant, record: detail.currentRecord }, month.monthYear)}><Text style={styles.smallPayText}>Pay</Text></Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Payment History</Text>
                  {(detail.history || []).length ? detail.history.map((record, index) => (
                    <View style={styles.historyRow} key={`${record.monthYear}-${index}`}>
                      <View style={styles.flex}>
                        <Text style={styles.monthName}>{monthText(record.dueDate)}</Text>
                        <Text style={styles.muted}>{money(record.paidAmount || 0)} / {money(record.rentAmount || 0)}{record.note ? ` · ${record.note}` : ''}</Text>
                      </View>
                      <StatusPill status={record.status} />
                      {Number(record.paidAmount || 0) > 0 ? (
                        <Pressable style={styles.editPayBtn} onPress={() => setEditingPayment(record)}>
                          <Text style={styles.editPayText}>Edit</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )) : <Text style={styles.muted}>No payment history yet.</Text>}
                </View>

                {buildPayable({ ...detail, tenant: detailTenant, record: detail.currentRecord }).length > 0 ? <AppButton title="Pay Pending Dues" icon="wallet-outline" onPress={() => openPay({ ...detail, tenant: detailTenant, record: detail.currentRecord })} /> : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ── Record payment ── */}
      <Modal visible={!!paying} transparent animationType="slide" onRequestClose={() => setPaying(null)}>
        <KeyboardAvoid modal style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Record Payment</Text>
              <Pressable onPress={() => setPaying(null)}><Icon name="close" size={22} color={colors.muted} /></Pressable>
            </View>
            <Text style={styles.muted}>{paying?.tenant?.name}</Text>
            <Text style={styles.fieldLabel}>Select Month / Advance to Pay</Text>
            <ScrollView style={styles.paymentOptions} contentContainerStyle={styles.paymentOptionsContent} showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {payOptions.map(option => {
                const selected = option.key === selectedPaymentKey;
                return (
                  <Pressable key={option.key} style={[styles.paymentOption, selected && styles.paymentOptionSelected]} onPress={() => choosePayment(option)}>
                    <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={20} color={selected ? colors.primary : colors.muted} />
                    <View style={styles.flex}>
                      <Text style={[styles.optionLabel, selected && { color: colors.primary }]}>{option.label}</Text>
                      <Text style={styles.muted}>{money(option.maxAmount)} remaining</Text>
                    </View>
                    {option.type === 'advance' ? <Text style={[styles.pill, { color: colors.warning, backgroundColor: colors.accentSoft }]}>Advance</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <AppInput label="Amount Paid" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <AppInput label="Note (Cash, UPI...)" value={note} onChangeText={setNote} />
            <AppButton title="Confirm Payment" icon="check" loading={saving} onPress={pay} />
          </View>
        </KeyboardAvoid>
      </Modal>

      {editingPayment ? (
        <EditPaymentModal record={editingPayment} onClose={() => setEditingPayment(null)} onSave={correctPayment} />
      ) : null}

      <ProfileImagePopup
        visible={!!profilePopup}
        imageUrl={profilePopup?.imageUrl}
        name={profilePopup?.name}
        onClose={() => setProfilePopup(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: 16 },
  overviewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 14 },
  overviewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  titleIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  overviewTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  overviewTop: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  overviewMetric: { flex: 1, minHeight: 68, paddingHorizontal: 10, justifyContent: 'center' },
  overviewMetricDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  overviewMetricLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '800', lineHeight: 13, minHeight: 26 },
  overviewMetricValue: { fontSize: 24, fontWeight: '900', marginTop: 2, maxWidth: '100%' },
  summaryRow: { flexDirection: 'row', paddingTop: 8 },
  summaryPanel: { flex: 1, minHeight: 70, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden', justifyContent: 'center' },
  summaryPanelDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  summaryLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase' },
  summaryValue: { fontSize: 21, fontWeight: '900', marginTop: 4, maxWidth: '100%' },
  summaryMessage: { color: colors.muted, fontSize: 10, marginTop: 2, lineHeight: 13 },

  filterCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 12, gap: 8 },
  filterHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTitle: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.faint },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.dangerSoft },
  clearText: { color: colors.danger, fontSize: 11, fontWeight: '800' },
  filterCount: { color: colors.muted, fontSize: 12, marginBottom: 10, fontWeight: '600' },

  skeletonList: { gap: 12 },
  skeletonCard: { minHeight: 190, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  skeletonLine: { height: 12, borderRadius: 8, backgroundColor: '#e4e8ef' },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e4e8ef' },
  skeletonName: { width: '62%', height: 16 },
  skeletonPhone: { width: '42%', marginTop: 8 },
  skeletonBadge: { width: 72, height: 24, borderRadius: 8, backgroundColor: '#e4e8ef' },
  skeletonLocation: { width: '58%', marginTop: 12 },
  skeletonAmountBlock: { flex: 1 },
  skeletonLabel: { width: '48%', height: 10 },
  skeletonAmount: { width: '66%', height: 24, marginTop: 7 },
  skeletonDueDate: { width: 84 },
  skeletonIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#e4e8ef' },
  skeletonPayBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: '#e4e8ef' },

  cardOverdue: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primarySoft },
  cardAvatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardAvatarText: { color: colors.primary, fontSize: 18, fontWeight: '900' },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  muted: { color: colors.muted, marginTop: 4 },
  badgeOverdue: { color: colors.danger, backgroundColor: colors.dangerSoft, fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  badgeSoon: { color: colors.warning, backgroundColor: colors.accentSoft, fontSize: 11, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, overflow: 'hidden' },
  location: { color: colors.primary, fontWeight: '800', marginTop: 10, fontSize: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  advBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  advPaid: { backgroundColor: colors.successSoft },
  advPending: { backgroundColor: colors.accentSoft },
  advText: { fontSize: 11, fontWeight: '800' },
  advanceBelowDue: { alignSelf: 'flex-start', marginTop: 6 },
  dueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  dueLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase' },
  due: { color: colors.text, fontSize: 22, fontWeight: '900' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  iconBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 10, backgroundColor: colors.primary },
  payText: { color: '#fff', fontWeight: '800' },
  more: { marginTop: 6, marginBottom: 90 },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.5)' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  detailModal: { height: '90%', paddingBottom: 16 },
  detailContent: { paddingTop: 8, paddingBottom: 20, gap: 4 },
  tenantHero: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 54, height: 54, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 54, height: 54, borderRadius: 16, borderWidth: 2, borderColor: colors.primarySoft },
  avatarText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  detailName: { color: colors.text, fontSize: 20, fontWeight: '900' },
  fullDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.primarySoft, backgroundColor: colors.faint },
  fullDetailsIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fullDetailsTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  fullDetailsSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  detailActions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 10 },
  actionPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10 },
  actionPillText: { fontSize: 12, fontWeight: '800' },
  detailGrid: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, marginTop: 14, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { color: colors.muted, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  detailValue: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  totalBox: { padding: 16, borderRadius: 14, backgroundColor: colors.dangerSoft, marginTop: 14 },
  detailTotal: { color: colors.danger, fontSize: 28, fontWeight: '900', marginTop: 3 },
  arrearsText: { color: colors.danger, fontSize: 11, marginTop: 2 },
  advanceBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.accentSoft, marginTop: 12 },
  advanceValue: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  detailSection: { marginTop: 18 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginBottom: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff7f7', marginBottom: 7 },
  monthName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  monthDue: { color: colors.danger, fontWeight: '900', fontSize: 12 },
  smallPay: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallPayText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  editPayBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.infoSoft },
  editPayText: { fontSize: 11, color: colors.info, fontWeight: '800' },
  centerBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17,24,39,0.5)' },
  centerModal: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 4 },
  editTwoCol: { flexDirection: 'row', gap: 9 },
  miniBox: { flex: 1, backgroundColor: colors.faint, borderRadius: 10, padding: 11, marginVertical: 8 },
  miniLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  miniValue: { fontSize: 14, color: colors.text, fontWeight: '900', marginTop: 3 },
  fieldLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', fontWeight: '800', marginTop: 16, marginBottom: 7 },
  paymentOptions: { maxHeight: 230 },
  paymentOptionsContent: { gap: 10, paddingBottom: 4 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.faint },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  footerSpacer: { height: 90 },
});

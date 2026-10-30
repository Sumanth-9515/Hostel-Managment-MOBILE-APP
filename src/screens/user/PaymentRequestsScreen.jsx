import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { paymentRequestApi } from '../../api/paymentRequestApi';
import { colors, screenPad, API_URL } from '../../utils/constants';
import { useSidebar } from '../../components/Sidebar';
import ProfileImagePopup from '../../components/ProfileImagePopup';

const BACKEND_URL = API_URL.replace(/\/api.*$/, '');

const money = value =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(value || 0));

const dateTime = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const messageOf = error =>
  error?.response?.data?.message || error?.message || 'Something went wrong.';

const receiptUrl = value => {
  if (!value) return '';
  return String(value).startsWith('http') ? value : `${BACKEND_URL}${value}`;
};

function StatusPill({ status }) {
  const palette = {
    Pending: { bg: colors.accentSoft, fg: colors.warning, icon: 'clock-outline' },
    Approved: { bg: colors.successSoft, fg: colors.success, icon: 'check-circle-outline' },
    Rejected: { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle-outline' },
  }[status] || { bg: colors.faint, fg: colors.muted, icon: 'help-circle-outline' };

  return (
    <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
      <Icon name={palette.icon} size={13} color={palette.fg} />
      <Text style={[styles.statusText, { color: palette.fg }]}>{status || 'Pending'}</Text>
    </View>
  );
}

function RejectModal({ visible, request, onClose, onSubmit, saving }) {
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };

  const submit = () => {
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Please enter rejection reason.');
      return;
    }
    onSubmit(reason.trim(), () => setReason(''));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHead}>
            <View>
              <Text style={styles.modalEyebrow}>Reject Request</Text>
              <Text style={styles.modalTitle}>{request?.tenantId?.name || 'Tenant'}</Text>
              <Text style={styles.modalSub}>{request?.monthYear || '-'}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={close}>
              <Icon name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Reason sent to tenant</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Example: Receipt amount is not clear."
            placeholderTextColor={colors.muted}
            multiline
            style={styles.reasonInput}
          />

          <Pressable disabled={saving} onPress={submit} style={[styles.rejectSubmit, saving && styles.disabled]}>
            <Text style={styles.rejectSubmitText}>{saving ? 'Rejecting...' : 'Reject & Send Mail'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RequestCard({ item, actingId, onApprove, onReject, onOpenProfile }) {
  const tenant = item.tenantId || {};
  const isPending = item.status === 'Pending';
  const proofUrl = receiptUrl(item.receiptUrl);
  const photo = tenant.documents?.passportPhoto;

  const openReceipt = () => {
    if (!proofUrl) return;
    Linking.openURL(proofUrl).catch(() => Alert.alert('Unable to open receipt', 'Please try again.'));
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable
          onPress={() => onOpenProfile?.({ imageUrl: photo, name: tenant.name })}
          style={styles.avatar}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Open profile photo for ${tenant.name || 'tenant'}`}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{(tenant.name?.[0] || '?').toUpperCase()}</Text>
          )}
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.tenantName}>{tenant.name || 'Tenant'}</Text>
          <Text style={styles.tenantMeta} numberOfLines={1}>{tenant.phone || '-'} {tenant.email ? `· ${tenant.email}` : ''}</Text>
          {tenant.allocationInfo?.buildingName ? (
            <Text style={styles.location} numberOfLines={1}>
              {tenant.allocationInfo.buildingName} · Room {tenant.allocationInfo.roomNumber || '-'}
            </Text>
          ) : null}
        </View>
        <StatusPill status={item.status} />
      </View>

      <View style={styles.infoGrid}>
        <Info label="Month" value={item.monthYear} />
        <Info label="Request" value={money(item.requestAmount)} accent />
        <Info label="Rent" value={money(item.rentAmount)} />
        <Info label="Pending" value={money(item.pendingAmount)} danger />
      </View>

      <View style={styles.modeRow}>
        <View style={styles.modeBadge}>
          <Icon name={item.paymentMode === 'cash' ? 'cash' : 'file-document-outline'} size={16} color={colors.primary} />
          <Text style={styles.modeText}>{item.paymentMode === 'cash' ? 'Cash handover' : 'Online receipt'}</Text>
        </View>
        <Text style={styles.dateText}>{dateTime(item.createdAt)}</Text>
      </View>

      {item.paymentMode === 'online' ? (
        <Pressable onPress={openReceipt} disabled={!proofUrl} style={styles.receiptBtn}>
          <Icon name="open-in-new" size={16} color={proofUrl ? colors.info : colors.muted} />
          <Text style={[styles.receiptText, !proofUrl && { color: colors.muted }]}>
            {proofUrl ? 'View receipt' : 'No receipt attached'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.cashBox}>
          <Icon name="calendar-clock" size={16} color={colors.warning} />
          <Text style={styles.cashText}>Cash given: {dateTime(item.cashGivenAt)}</Text>
        </View>
      )}

      {item.rejectionReason ? (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Rejected reason</Text>
          <Text style={styles.reasonText}>{item.rejectionReason}</Text>
        </View>
      ) : null}

      {isPending ? (
        <View style={styles.actions}>
          <Pressable disabled={actingId === item._id} onPress={() => onApprove(item)} style={[styles.actionBtn, styles.approveBtn, actingId === item._id && styles.disabled]}>
            <Icon name="check" size={18} color="#fff" />
            <Text style={styles.actionText}>Approve</Text>
          </Pressable>
          <Pressable disabled={actingId === item._id} onPress={() => onReject(item)} style={[styles.actionBtn, styles.rejectBtn, actingId === item._id && styles.disabled]}>
            <Icon name="close" size={18} color="#fff" />
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Info({ label, value, accent, danger }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary }, danger && { color: colors.danger }]} numberOfLines={1}>
        {value || '-'}
      </Text>
    </View>
  );
}

export default function PaymentRequestsScreen() {
  const sidebar = useSidebar();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [profilePopup, setProfilePopup] = useState(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await paymentRequestApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Unable to load payment requests', messageOf(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      const tenant = item.tenantId || {};
      return [
        tenant.name,
        tenant.phone,
        tenant.email,
        item.monthYear,
        item.status,
        item.paymentMode,
      ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [items, query]);

  const pendingCount = items.filter(item => item.status === 'Pending').length;

  const approve = item => {
    Alert.alert(
      'Approve payment request?',
      `This will update rent payment for ${item.tenantId?.name || 'tenant'} (${item.monthYear}).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActingId(item._id);
            try {
              const res = await paymentRequestApi.approve(item._id);
              Alert.alert('Approved', res.message || 'Payment request approved.');
              await load({ refresh: true });
            } catch (error) {
              Alert.alert('Approval failed', messageOf(error));
            } finally {
              setActingId('');
            }
          },
        },
      ],
    );
  };

  const reject = async (reason, resetReason) => {
    if (!rejecting?._id) return;
    setActingId(rejecting._id);
    try {
      const res = await paymentRequestApi.reject(rejecting._id, reason);
      resetReason?.();
      setRejecting(null);
      Alert.alert('Rejected', res.message || 'Payment request rejected.');
      await load({ refresh: true });
    } catch (error) {
      Alert.alert('Reject failed', messageOf(error));
    } finally {
      setActingId('');
    }
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Icon name="credit-card-check-outline" size={42} color={colors.muted} />
      <Text style={styles.emptyTitle}>{loading ? 'Loading payment requests...' : 'No payment requests found'}</Text>
      {!loading ? <Text style={styles.emptyText}>Tenant submitted payment requests will appear here.</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={sidebar.open} style={styles.menuBtn}>
          <Icon name="menu" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Payment Requests</Text>
          <Text style={styles.subtitle}>{pendingCount} pending approval{pendingCount === 1 ? '' : 's'}</Text>
        </View>
        <Pressable onPress={() => load({ refresh: true })} style={styles.refreshBtn}>
          <Icon name="refresh" size={21} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Icon name="magnify" size={19} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tenant, month, status"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => item._id || String(index)}
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            actingId={actingId}
            onApprove={approve}
            onReject={setRejecting}
            onOpenProfile={setProfilePopup}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} tintColor={colors.primary} />}
      />

      <RejectModal
        visible={!!rejecting}
        request={rejecting}
        onClose={() => setRejecting(null)}
        onSubmit={reject}
        saving={!!actingId}
      />
      <ProfileImagePopup
        visible={!!profilePopup}
        imageUrl={profilePopup?.imageUrl}
        name={profilePopup?.name}
        onClose={() => setProfilePopup(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: screenPad, paddingTop: 8, paddingBottom: 12 },
  menuBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  refreshBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  search: { marginHorizontal: screenPad, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, height: 46, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', padding: 0 },
  list: { padding: screenPad, paddingTop: 6, gap: 12, flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.border, shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 44, height: 44, borderRadius: 14 },
  avatarText: { color: colors.primary, fontSize: 16, fontWeight: '900' },
  tenantName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  tenantMeta: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  location: { color: colors.primary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  infoBox: { width: '48.6%', padding: 10, borderRadius: 13, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 5 },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.primarySoft },
  modeText: { color: colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'capitalize' },
  dateText: { color: colors.muted, fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'right' },
  receiptBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 13, backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.border },
  receiptText: { color: colors.info, fontSize: 13, fontWeight: '900' },
  cashBox: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 7, padding: 11, borderRadius: 13, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: '#fde68a' },
  cashText: { color: colors.warning, fontSize: 12, fontWeight: '900', flex: 1 },
  reasonBox: { marginTop: 12, padding: 11, borderRadius: 13, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: '#fecaca' },
  reasonLabel: { color: colors.danger, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  reasonText: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  approveBtn: { backgroundColor: colors.success },
  rejectBtn: { backgroundColor: colors.danger },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.58)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 24 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  modalEyebrow: { color: colors.danger, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  modalTitle: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 2 },
  modalSub: { color: colors.muted, fontSize: 13, fontWeight: '800', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.faint },
  inputLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  reasonInput: { minHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.faint, color: colors.text, paddingHorizontal: 13, paddingVertical: 12, textAlignVertical: 'top', fontSize: 14, fontWeight: '700' },
  rejectSubmit: { marginTop: 14, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  rejectSubmitText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});

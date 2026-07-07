import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import ScreenSkeleton from '../../components/Skeleton';
import { useSidebar } from '../../components/Sidebar';
import { tenantApi } from '../../api/tenantApi';
import { colors, ONBOARDING_PUBLIC_URL } from '../../utils/constants';
import { compactLocation, dateText, getMessage, money } from '../../utils/helpers';

// ---------- Small building blocks ----------

// One owner = one permanent onboarding link (never expires). The backend can
// return the token directly (same as the website) or inside a link/url.
function buildOnboardingLink(payload) {
  const rawLink = payload?.link || payload?.url || '';
  const token = payload?.token || (rawLink ? String(rawLink).split('/').pop() : '');
  if (!token) return '';
  return `${ONBOARDING_PUBLIC_URL}/tenant-register/${token}`;
}

const SHARE_MESSAGE_LINES = [
  'Please open this link and complete your hostel onboarding form:',
  '',
  'If it does not open, copy the link and paste it in Chrome, then fill the form.',
];

function buildShareMessage(link) {
  return [SHARE_MESSAGE_LINES[0], link, '', SHARE_MESSAGE_LINES[2]].join('\n');
}

function KPI({ value, label, last }) {
  return (
    <View style={[styles.kpi, !last && styles.kpiDivider]}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Segment({ label, active, onPress }) {
  return (
    <Pressable style={[styles.segment, active && styles.segmentActive]} onPress={onPress} hitSlop={4}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DocumentsModal({ tenant, onClose, onFullDetails }) {
  const entries = [['passportPhoto', 'Passport Photo'], ['aadharFront', 'Aadhaar Front'], ['aadharBack', 'Aadhaar Back']];
  return (
    <Modal visible={!!tenant} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <View>
              <Text style={styles.modalTitle}>Candidate Documents</Text>
              <Text style={styles.muted}>{tenant?.name}</Text>
            </View>
            <Pressable style={styles.close} onPress={onClose} hitSlop={6}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Pressable style={styles.fullDetailsBtn} onPress={onFullDetails}>
              <View style={styles.fullDetailsIcon}><Icon name="account-details-outline" size={18} color={colors.primary} /></View>
              <View style={styles.flex}>
                <Text style={styles.fullDetailsTitle}>View Full Details</Text>
                <Text style={styles.fullDetailsSub}>Profile, allocation, financials & documents</Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
            {entries.map(([key, label]) => (
              <View style={styles.document} key={key}>
                <Text style={styles.docTitle}>{label}</Text>
                {tenant?.documents?.[key] ? (
                  <Pressable onPress={() => Linking.openURL(tenant.documents[key])}>
                    <Image source={{ uri: tenant.documents[key] }} style={styles.documentImage} />
                    <View style={styles.openDoc}>
                      <Icon name="open-in-new" size={13} color={colors.primary} />
                      <Text style={styles.openText}>Open full size</Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.missingDoc}>
                    <Icon name="file-remove-outline" size={22} color={colors.muted} />
                    <Text style={styles.muted}>Not uploaded</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ShareModal({ visible, link, onClose }) {
  const [mode, setMode] = useState('whatsapp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatusMsg] = useState(null);

  const reset = () => {
    setPhone('');
    setEmail('');
    setStatusMsg(null);
    setSending(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const shareWhatsApp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setStatusMsg({ type: 'error', message: 'Enter a valid WhatsApp number.' });
      return;
    }
    const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildShareMessage(link))}`;
    try {
      await Linking.openURL(url);
      close();
    } catch {
      setStatusMsg({ type: 'error', message: 'Could not open WhatsApp.' });
    }
  };

  const sendEmail = async () => {
    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setStatusMsg({ type: 'error', message: 'Enter a valid email.' });
      return;
    }
    setSending(true);
    setStatusMsg(null);
    try {
      await tenantApi.shareLinkEmail({ email: cleaned, link });
      setStatusMsg({ type: 'success', message: 'Email sent.' });
      setEmail('');
    } catch (error) {
      setStatusMsg({ type: 'error', message: getMessage(error) || 'Email failed.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoid modal style={styles.flex}>
      <Pressable style={styles.shareBackdrop} onPress={close}>
        <Pressable style={styles.shareCard} onPress={() => {}}>
          <View style={styles.shareHead}>
            <View style={styles.flex}>
              <Text style={styles.shareTitle}>Share onboarding link</Text>
              <Text style={styles.shareSubtitle}>Send the form link to a candidate.</Text>
            </View>
            <Pressable style={styles.close} onPress={close} hitSlop={6}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.shareTabs}>
            {['whatsapp', 'email'].map(item => (
              <Pressable
                key={item}
                style={[styles.shareTab, mode === item && styles.shareTabActive]}
                onPress={() => { setMode(item); setStatusMsg(null); }}
              >
                <Text style={[styles.shareTabText, mode === item && styles.shareTabTextActive]}>
                  {item === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'email' ? (
            <AppInput
              placeholder="Enter email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          ) : (
            <AppInput
              placeholder="Enter mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          )}

          {status ? (
            <Text style={[styles.shareStatus, status.type === 'error' ? styles.shareStatusError : styles.shareStatusOk]}>
              {status.message}
            </Text>
          ) : null}

          <View style={styles.shareActions}>
            <Pressable style={styles.shareCancel} onPress={close}>
              <Text style={styles.shareCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.shareSubmit, sending && styles.shareSubmitDisabled]}
              onPress={mode === 'email' ? sendEmail : shareWhatsApp}
              disabled={sending}
            >
              <Text style={styles.shareSubmitText}>
                {mode === 'email' ? (sending ? 'Sending…' : 'Send email') : 'Share on WhatsApp'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoid>
    </Modal>
  );
}

// ---------- Screen ----------

export default function OnboardingScreen({ navigation, onLogout }) {
  const { open } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [link, setLink] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [documents, setDocuments] = useState(null);

  const loadLink = useCallback(async () => {
    setLinkLoading(true);
    try {
      const data = await tenantApi.generateLink();
      setLink(buildOnboardingLink(data));
    } catch (error) {
      Alert.alert('Link failed', getMessage(error));
    } finally {
      setLinkLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await tenantApi.list({ source: 'onboarding-link' });
      setTenants(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Onboarding error', getMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); loadLink(); }, [load, loadLink]));

  const filtered = useMemo(() => tenants.filter(item => {
    const query = search.trim().toLowerCase();
    const match = !query || item.name?.toLowerCase().includes(query) || item.phone?.includes(query) || item.email?.toLowerCase().includes(query) || item.allocationInfo?.buildingName?.toLowerCase().includes(query);
    return match && (status === 'all' || item.status === status);
  }), [tenants, search, status]);

  const stats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter(t => t.status === 'Active').length,
    allocated: tenants.filter(t => t.buildingId || t.allocationInfo?.buildingName).length,
    inactive: tenants.filter(t => t.status === 'Inactive').length,
  }), [tenants]);

  if (loading) return <ScreenSkeleton header stats={4} rows={5} />;
  const qrUrl = link ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(link)}` : '';

  return (
    <View style={styles.screen}>
      <AppHeader title="Onboarding Manager" subtitle="Self-registration and candidate tracking" onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Add candidate — compact row, not a big banner */}
        <Pressable style={styles.manualRow} onPress={() => navigation.navigate('AddCandidate')}>
          <View style={styles.manualIcon}>
            <Icon name="account-plus-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.manualTitle}>Add candidate manually</Text>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </Pressable>

        {/* KPI row — single card, hairline-divided, no boxes */}
        <View style={styles.kpiRow}>
          <KPI value={stats.total} label="Via link" />
          <KPI value={stats.active} label="Active" />
          <KPI value={stats.allocated} label="Allocated" />
          <KPI value={stats.inactive} label="Vacated" last />
        </View>

        {/* Onboarding link — one permanent link per owner, never expires */}
        <View style={styles.card}>
          <View style={styles.linkHeadRow}>
            <Text style={styles.cardTitle}>Onboarding link</Text>
            <Text style={styles.cardMeta}>{link ? 'Permanent · No expiry' : (linkLoading ? 'Loading…' : 'Unavailable')}</Text>
          </View>

          {link ? (
            <>
              <Text numberOfLines={1} ellipsizeMode="middle" style={styles.link}>{link}</Text>
              <View style={styles.linkActionsRow}>
                <Pressable style={styles.iconAction} onPress={() => setShareOpen(true)} hitSlop={4}>
                  <Icon name="share-variant-outline" size={16} color={colors.primary} />
                  <Text style={styles.iconActionText}>Share</Text>
                </Pressable>
                <Pressable style={styles.iconAction} onPress={() => setShowQr(v => !v)} hitSlop={4}>
                  <Icon name="qrcode" size={16} color={colors.primary} />
                  <Text style={styles.iconActionText}>{showQr ? 'Hide QR' : 'QR code'}</Text>
                </Pressable>
                <Pressable style={styles.iconAction} onPress={() => Linking.openURL(link)} hitSlop={4}>
                  <Icon name="open-in-new" size={16} color={colors.primary} />
                  <Text style={styles.iconActionText}>Preview</Text>
                </Pressable>
                <Pressable style={styles.regenAction} onPress={loadLink} disabled={linkLoading} hitSlop={4}>
                  <Icon name="refresh" size={16} color={colors.muted} />
                </Pressable>
              </View>
              {showQr ? (
                <View style={styles.qrBox}>
                  <Image source={{ uri: qrUrl }} style={styles.qr} />
                  <Text style={styles.qrText}>Scan to open the registration form</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Pressable style={styles.generateRow} onPress={loadLink} disabled={linkLoading}>
              <Icon name="link-variant" size={16} color="#fff" />
              <Text style={styles.generateText}>{linkLoading ? 'Loading link…' : 'Reload link'}</Text>
            </Pressable>
          )}
        </View>

        {/* Candidates section header + search + segmented filters */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>Self-registered candidates</Text>
          <Text style={styles.cardMeta}>{filtered.length}</Text>
        </View>

        <AppInput placeholder="Search name, phone, email or building" value={search} onChangeText={setSearch} style={styles.search} />

        <View style={styles.segmentTrack}>
          <Segment label="All" active={status === 'all'} onPress={() => setStatus('all')} />
          <Segment label="Active" active={status === 'Active'} onPress={() => setStatus('Active')} />
          <Segment label="Vacated" active={status === 'Inactive'} onPress={() => setStatus('Inactive')} />
        </View>

        {/* Candidate list — compact rows */}
        {filtered.length ? filtered.map(item => (
          <Pressable key={item._id} style={styles.candidateRow} onPress={() => setDocuments(item)}>
            {item.documents?.passportPhoto ? (
              <Image source={{ uri: item.documents.passportPhoto }} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}>
                <Text style={styles.photoText}>{item.name?.[0]?.toUpperCase()}</Text>
              </View>
            )}

            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.dot, item.status === 'Inactive' && styles.dotInactive]} />
                <Text style={[styles.statusText, item.status === 'Inactive' && styles.statusTextInactive]}>
                  {item.status === 'Inactive' ? 'Vacated' : 'Active'}
                </Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {item.phone}{item.email ? ` · ${item.email}` : ''}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.allocationInfo?.buildingName ? compactLocation(item) : 'Unallocated'} · {dateText(item.joiningDate)}
              </Text>
            </View>

            <View style={styles.trailing}>
              <Text style={styles.rent}>{money(item.rentAmount || 0)}</Text>
              <Icon name="chevron-right" size={16} color={colors.muted} />
            </View>
          </Pressable>
        )) : (
          <EmptyState
            title="No onboarding candidates"
            message={tenants.length ? 'No candidates match this filter.' : 'Share the onboarding link and registrations will appear here.'}
            icon="account-clock-outline"
          />
        )}

        <View style={styles.footer} />
      </ScrollView>
      <DocumentsModal
        tenant={documents}
        onClose={() => setDocuments(null)}
        onFullDetails={() => { const id = documents?._id; setDocuments(null); if (id) navigation.navigate('TenantDetails', { tenantId: id }); }}
      />
      <ShareModal visible={shareOpen} link={link} onClose={() => setShareOpen(false)} />
    </View>
  );
}

const RADIUS = 14;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 14, gap: 10 },
  flex: { flex: 1 },
  footer: { height: 70 },
  muted: { fontSize: 11, color: colors.muted, marginTop: 2 },

  // Add candidate row
  manualRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: RADIUS,
    paddingVertical: 11, paddingHorizontal: 12,
  },
  manualIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  manualTitle: { flex: 1, fontSize: 13.5, color: colors.text, fontWeight: '700' },

  // KPI row
  kpiRow: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: RADIUS,
    paddingVertical: 12,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: colors.muted, marginTop: 2, fontWeight: '600' },

  // Generic card
  card: { backgroundColor: colors.surface, borderRadius: RADIUS, padding: 13 },
  cardTitle: { fontSize: 13.5, color: colors.text, fontWeight: '800' },
  cardMeta: { fontSize: 11, color: colors.muted, fontWeight: '600' },

  // Onboarding link
  linkHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: {
    fontSize: 11.5, color: colors.primary, fontWeight: '600',
    marginTop: 9, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: colors.primarySoft, borderRadius: 9,
  },
  linkActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 16 },
  iconAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  iconActionText: { fontSize: 11.5, color: colors.primary, fontWeight: '700' },
  regenAction: { marginLeft: 'auto', padding: 2 },
  qrBox: { alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  qr: { width: 140, height: 140, borderRadius: 8 },
  qrText: { fontSize: 10, color: colors.muted, marginTop: 7 },
  generateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, marginTop: 10,
  },
  generateText: { fontSize: 12.5, color: '#fff', fontWeight: '800' },

  // Section header
  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginTop: 4 },
  sectionTitle: { fontSize: 14, color: colors.text, fontWeight: '800' },

  // Search + segmented control
  search: { minHeight: 0 },
  segmentTrack: {
    flexDirection: 'row', backgroundColor: colors.faint, borderRadius: 10, padding: 3, gap: 3,
  },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: colors.primary },

  // Candidate list rows
  candidateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: RADIUS,
    paddingVertical: 10, paddingHorizontal: 11,
  },
  photo: { width: 40, height: 40, borderRadius: 11 },
  photoFallback: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  photoText: { fontSize: 15, color: colors.primary, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 13.5, color: colors.text, fontWeight: '800', flexShrink: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success, marginLeft: 2 },
  dotInactive: { backgroundColor: colors.danger },
  statusText: { fontSize: 10.5, color: colors.success, fontWeight: '700' },
  statusTextInactive: { color: colors.danger },
  meta: { fontSize: 10.5, color: colors.muted, marginTop: 2 },
  trailing: { alignItems: 'flex-end', gap: 4 },
  rent: { fontSize: 12, color: colors.text, fontWeight: '800' },

  // Documents modal
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.55)' },
  modal: { height: '86%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 16, color: colors.text, fontWeight: '800' },
  close: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 16 },
  fullDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.primarySoft, backgroundColor: colors.faint },
  fullDetailsIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fullDetailsTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  fullDetailsSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  document: { marginBottom: 16 },
  docTitle: { fontSize: 11, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  documentImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.faint, resizeMode: 'contain' },
  openDoc: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 6 },
  openText: { fontSize: 10, color: colors.primary, fontWeight: '700' },
  missingDoc: { height: 100, borderRadius: 11, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },

  // Share modal
  shareBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: 'rgba(15,23,42,.55)' },
  shareCard: { width: '100%', maxWidth: 440, backgroundColor: colors.surface, borderRadius: 18, padding: 18 },
  shareHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  shareTitle: { fontSize: 16, color: colors.text, fontWeight: '800' },
  shareSubtitle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  shareTabs: { flexDirection: 'row', backgroundColor: colors.faint, borderRadius: 10, padding: 3, gap: 3, marginBottom: 14 },
  shareTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  shareTabActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  shareTabText: { fontSize: 12.5, color: colors.muted, fontWeight: '800' },
  shareTabTextActive: { color: colors.primary },
  shareStatus: { fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  shareStatusError: { color: colors.danger },
  shareStatusOk: { color: colors.success },
  shareActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  shareCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  shareCancelText: { fontSize: 12.5, color: colors.muted, fontWeight: '700' },
  shareSubmit: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.success },
  shareSubmitDisabled: { opacity: 0.7 },
  shareSubmitText: { fontSize: 12.5, color: '#fff', fontWeight: '800' },
});

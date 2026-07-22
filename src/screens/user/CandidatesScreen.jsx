import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import { DetailSkeleton } from '../../components/Skeleton';
import { buildingApi } from '../../api/buildingApi';
import { tenantApi } from '../../api/tenantApi';
import { rentApi } from '../../api/rentApi';
import { colors } from '../../utils/constants';
import { compactLocation, dateText, getMessage, money } from '../../utils/helpers';

const candidatesCache = {
  hasData: false,
  tenants: [],
  rentMap: new Map(),
  buildings: [],
};

// ---------- Small building blocks ----------

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

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function DetailInfo({ label, value, accent }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

function CandidateRow({ tenant, rent, onPress }) {
  const overdue = rent?.hasPreviousPending;
  const due = Number(rent?.totalAccumulatedDue || 0);
  const advance = Number(tenant.advanceAmount || 0);
  const paidAdvance = Number(tenant.paidAdvanceAmount ?? tenant.paidadvanceAmount ?? 0);
  const inactive = tenant.status === 'Inactive';

  return (
    <Pressable style={[styles.row, overdue && styles.rowOverdue]} onPress={onPress}>
      {tenant.documents?.passportPhoto ? (
        <Image source={{ uri: tenant.documents.passportPhoto }} style={styles.photo} />
      ) : (
        <View style={styles.photoFallback}>
          <Text style={styles.photoText}>{tenant.name?.[0]?.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{tenant.name}</Text>
          <View style={[styles.dot, inactive && styles.dotInactive]} />
          <Text style={[styles.statusText, inactive && styles.statusTextInactive]}>
            {inactive ? 'Vacated' : 'Active'}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {tenant.phone}{tenant.email ? ` · ${tenant.email}` : ''}
        </Text>
        <Text style={styles.location} numberOfLines={1}>{compactLocation(tenant)}</Text>

        <View style={styles.financeStrip}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Rent</Text>
            <Text style={styles.financeValue}>{money(tenant.rentAmount || 0)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Due</Text>
            <Text style={[styles.financeValue, due > 0 && styles.financeDanger]}>{money(due)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Advance</Text>
            <Text style={styles.financeValue}>{money(Math.max(0, advance - paidAdvance))}</Text>
          </View>
        </View>

        {overdue ? (
          <View style={styles.overdueRow}>
            <Icon name="alert-circle" size={12} color={colors.danger} />
            <Text style={styles.overdueText}>
              {rent.pendingMonthsCount || rent.pendingMonths?.length || 1} month(s) unpaid
            </Text>
          </View>
        ) : null}
      </View>

      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

function CandidatesDataSkeleton() {
  return (
    <View pointerEvents="none">
      <View style={styles.kpiRow}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.kpi, i < 3 && styles.kpiDivider]}>
            <View style={[styles.skeletonBlock, { width: 34, height: 18 }]} />
            <View style={[styles.skeletonBlock, { width: 44, height: 10, marginTop: 4 }]} />
          </View>
        ))}
      </View>
      <View style={styles.searchCard}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[styles.skeletonBlock, { flex: 1, height: 32, borderRadius: 8 }]} />
          <View style={[styles.skeletonBlock, { flex: 1, height: 32, borderRadius: 8 }]} />
        </View>
        <View style={[styles.skeletonBlock, { width: '100%', height: 42, borderRadius: 10, marginTop: 4 }]} />
      </View>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.row, { marginTop: 10 }]}>
          <View style={[styles.skeletonBlock, { width: 40, height: 40, borderRadius: 11 }]} />
          <View style={styles.flex}>
            <View style={[styles.skeletonBlock, { width: '60%', height: 14 }]} />
            <View style={[styles.skeletonBlock, { width: '45%', height: 10, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '35%', height: 10, marginTop: 6 }]} />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              {[0, 1, 2].map(j => (
                <View key={j}>
                  <View style={[styles.skeletonBlock, { width: 40, height: 8 }]} />
                  <View style={[styles.skeletonBlock, { width: 34, height: 12, marginTop: 3 }]} />
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------- Screen ----------

export default function CandidatesScreen({ navigation, route }) {
  const [dataLoading, setDataLoading] = useState(!candidatesCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [tenants, setTenants] = useState(candidatesCache.tenants);
  const [rentMap, setRentMap] = useState(candidatesCache.rentMap);
  const [buildings, setBuildings] = useState(candidatesCache.buildings);

  const [q, setQ] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [docs, setDocs] = useState({});
  const [saving, setSaving] = useState(false);
  const [allocation, setAllocation] = useState({ buildingId: '', floorId: '', roomId: '', bedId: '' });
  const [availableBeds, setAvailableBeds] = useState([]);

  const hasLoadedRef = useRef(candidatesCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [tenantList, rentList, buildingList] = await Promise.all([
        tenantApi.list(),
        rentApi.all(),
        buildingApi.list(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      const safeTenants = Array.isArray(tenantList) ? tenantList : [];
      const safeRentMap = new Map((Array.isArray(rentList) ? rentList : []).map(item => [String(item.tenant?._id || item.tenantId), item]));
      const safeBuildings = Array.isArray(buildingList) ? buildingList : [];

      setTenants(safeTenants);
      setRentMap(safeRentMap);
      setBuildings(safeBuildings);

      candidatesCache.hasData = true;
      candidatesCache.tenants = safeTenants;
      candidatesCache.rentMap = safeRentMap;
      candidatesCache.buildings = safeBuildings;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || candidatesCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [load]));

  // When opened from an activity log with a tenant name, pre-fill the search so
  // only that candidate is shown (the debounced effect below runs the search).
  useEffect(() => {
    const incoming = route?.params?.search;
    if (incoming) {
      setSearchType('name');
      setQ(incoming);
      navigation.setParams({ search: undefined });
    }
  }, [route?.params?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async id => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await rentApi.tenant(id);
      setDetail(data);
      const t = data.tenant;
      setEditForm({
        name: t.name || '', phone: t.phone || '', email: t.email || '',
        fatherName: t.fatherName || '', fatherPhone: t.fatherPhone || '',
        permanentAddress: t.permanentAddress || '', joiningDate: t.joiningDate?.slice(0, 10) || '',
        rentAmount: String(t.rentAmount || ''), advanceAmount: String(t.advanceAmount || ''),
      });
    } catch (error) {
      setSelectedId(null);
      Alert.alert('Candidate details', getMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const search = async () => {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const data = await rentApi.search({ q: q.trim(), type: searchType });
      setSearchResults((Array.isArray(data) ? data : []).map(item => item.tenant).filter(Boolean));
    } catch (error) {
      setSearchResults([]);
      Alert.alert('Search failed', getMessage(error));
    } finally {
      setSearching(false);
    }
  };
  useEffect(() => {
    if (!q.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(search, 400);
    return () => clearTimeout(timer);
  }, [q, searchType]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const rents = [...rentMap.values()];
    return {
      active: tenants.filter(t => t.status === 'Active').length,
      inactive: tenants.filter(t => t.status === 'Inactive').length,
      dues: rents.filter(r => !r.hasPreviousPending && r.currentRecord?.status !== 'Paid').length,
      overdue: rents.filter(r => r.hasPreviousPending).length,
    };
  }, [tenants, rentMap]);

  const source = searchResults ?? tenants;
  const rank = tenant => {
    const rent = rentMap.get(String(tenant._id));
    if (rent?.hasPreviousPending) return 0;
    if (rent?.currentRecord?.status === 'Due') return 1;
    if (rent?.currentRecord?.status === 'Partial') return 2;
    return 3;
  };
  const activeList = [...source.filter(t => t.status === 'Active')].sort((a, b) => rank(a) - rank(b));
  const inactiveList = source.filter(t => t.status === 'Inactive');

  const selectedBuilding = buildings.find(item => item._id === allocation.buildingId);
  const floors = selectedBuilding?.floors || [];
  const selectedFloor = floors.find(item => item._id === allocation.floorId);
  const rooms = selectedFloor?.rooms || [];
  useEffect(() => {
    if (!allocation.buildingId || !allocation.floorId || !allocation.roomId) { setAvailableBeds([]); return; }
    buildingApi.availableBeds(allocation.buildingId, allocation.floorId, allocation.roomId)
      .then(data => setAvailableBeds(data.availableBeds || []))
      .catch(() => setAvailableBeds([]));
  }, [allocation.buildingId, allocation.floorId, allocation.roomId]);

  const beginEdit = () => { setEditing(true); setDocs({}); setAllocation({ buildingId: '', floorId: '', roomId: '', bedId: '' }); };
  const pickDoc = key => launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, result => {
    const asset = result.assets?.[0];
    if (asset?.uri) setDocs(prev => ({ ...prev, [key]: { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || `${key}.jpg` } }));
  });

  const save = async () => {
    const tenant = detail?.tenant;
    if (!tenant) return;
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([key, value]) => fd.append(key, key === 'advanceAmount' ? String(Number(value || 0)) : value));
      Object.entries(docs).forEach(([key, file]) => fd.append(key, file));
      await tenantApi.update(tenant._id, fd);
      if (allocation.bedId) await tenantApi.reallocate(tenant._id, allocation);
      setEditing(false);
      await load();
      await openDetail(tenant._id);
    } catch (error) {
      Alert.alert('Update failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const vacate = () => Alert.alert('Vacate tenant?', `${detail?.tenant?.name} will be marked inactive and their bed will be freed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Vacate', style: 'destructive', onPress: async () => {
      try {
        await tenantApi.vacate(detail.tenant._id);
        setSelectedId(null); setDetail(null); load();
      } catch (error) {
        Alert.alert('Vacate failed', getMessage(error));
      }
    } },
  ]);

  const close = () => { setSelectedId(null); setDetail(null); setEditing(false); };

  const hasData = candidatesCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  const t = detail?.tenant;
  const current = detail?.currentRecord;

  return (
    <View style={styles.screen}>
      <AppHeader title="Candidates Management" subtitle="All registered tenant candidates" onBack={() => navigation.goBack()} rightIcon="account-plus-outline" onRightPress={() => navigation.navigate('AddCandidate')} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {showSkeleton ? (
          <CandidatesDataSkeleton />
        ) : showError ? (
          <EmptyState title="Unable to load candidates" message={dataError} icon="wifi-alert" />
        ) : (
          <>
            {/* KPI row — single card, hairline-divided */}
            <View style={styles.kpiRow}>
              <KPI value={stats.active} label="Active" />
              <KPI value={stats.dues} label="Dues" />
              <KPI value={stats.overdue} label="Overdue" />
              <KPI value={stats.inactive} label="Vacated" last />
            </View>

            {/* Search — segmented type + compact input */}
            <View style={styles.searchCard}>
              <View style={styles.segmentTrack}>
                <Segment label="By name" active={searchType === 'name'} onPress={() => { setSearchType('name'); setQ(''); setSearchResults(null); }} />
                <Segment label="By room" active={searchType === 'room'} onPress={() => { setSearchType('room'); setQ(''); setSearchResults(null); }} />
              </View>
              <View style={styles.searchInputRow}>
                <Icon name="magnify" size={16} color={colors.muted} style={styles.searchIcon} />
                <AppInput
                  placeholder={searchType === 'name' ? 'Search tenant name' : 'Search room number'}
                  value={q}
                  onChangeText={setQ}
                  style={styles.searchInput}
                />
                {searching ? <Icon name="loading" size={16} color={colors.muted} /> : null}
              </View>
            </View>

            {activeList.length ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Active</Text>
                  <Text style={styles.sectionCount}>{activeList.length}</Text>
                </View>
                {activeList.map(item => (
                  <CandidateRow key={item._id} tenant={item} rent={rentMap.get(String(item._id))} onPress={() => openDetail(item._id)} />
                ))}
              </>
            ) : null}

            {inactiveList.length ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleMuted]}>Vacated</Text>
                  <Text style={styles.sectionCount}>{inactiveList.length}</Text>
                </View>
                {inactiveList.map(item => (
                  <CandidateRow key={item._id} tenant={item} rent={rentMap.get(String(item._id))} onPress={() => openDetail(item._id)} />
                ))}
              </>
            ) : null}

            {!activeList.length && !inactiveList.length ? <EmptyState title="No candidates found" icon="account-search-outline" /> : null}
          </>
        )}
        <View style={styles.footer} />
      </ScrollView>

      <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoid modal style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View>
                <Text style={styles.sheetTitle}>{editing ? 'Edit candidate' : 'Candidate details'}</Text>
                <Text style={styles.muted}>{t?.name}</Text>
              </View>
              <View style={styles.sheetActions}>
                {!editing && t?.status === 'Active' ? (
                  <>
                    <Pressable style={styles.actionIcon} onPress={beginEdit}>
                      <Icon name="pencil-outline" size={17} color={colors.primary} />
                    </Pressable>
                    <Pressable style={styles.actionIcon} onPress={vacate}>
                      <Icon name="logout" size={17} color={colors.danger} />
                    </Pressable>
                  </>
                ) : null}
                <Pressable style={styles.actionIcon} onPress={close}>
                  <Icon name="close" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {detailLoading ? <DetailSkeleton /> : t ? (
              <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
                {editing ? (
                  <>
                    <Text style={styles.formSection}>Basic information</Text>
                    <AppInput label="Full name" value={editForm.name} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />
                    <View style={styles.twoCol}>
                      <View style={styles.flex}><AppInput label="Phone" value={editForm.phone} onChangeText={v => setEditForm(p => ({ ...p, phone: v }))} keyboardType="phone-pad" /></View>
                      <View style={styles.flex}><AppInput label="Email" value={editForm.email} onChangeText={v => setEditForm(p => ({ ...p, email: v }))} keyboardType="email-address" /></View>
                    </View>
                    <View style={styles.twoCol}>
                      <View style={styles.flex}><AppInput label="Monthly rent" value={editForm.rentAmount} onChangeText={v => setEditForm(p => ({ ...p, rentAmount: v }))} keyboardType="numeric" /></View>
                      <View style={styles.flex}><AppInput label="Advance" value={editForm.advanceAmount} onChangeText={v => setEditForm(p => ({ ...p, advanceAmount: v }))} keyboardType="numeric" /></View>
                    </View>
                    <AppInput label="Joining date" value={editForm.joiningDate} onChangeText={v => setEditForm(p => ({ ...p, joiningDate: v }))} />
                    <AppInput label="Permanent address" value={editForm.permanentAddress} onChangeText={v => setEditForm(p => ({ ...p, permanentAddress: v }))} multiline />
                    <View style={styles.twoCol}>
                      <View style={styles.flex}><AppInput label="Father's name" value={editForm.fatherName} onChangeText={v => setEditForm(p => ({ ...p, fatherName: v }))} /></View>
                      <View style={styles.flex}><AppInput label="Father's phone" value={editForm.fatherPhone} onChangeText={v => setEditForm(p => ({ ...p, fatherPhone: v }))} /></View>
                    </View>

                    <Text style={styles.formSection}>Replace documents (optional)</Text>
                    <View style={styles.docButtons}>
                      {[['aadharFront', 'Aadhaar Front'], ['aadharBack', 'Aadhaar Back'], ['passportPhoto', 'Photo']].map(([key, label]) => (
                        <Pressable key={key} style={[styles.docButton, docs[key] && styles.docSelected]} onPress={() => pickDoc(key)}>
                          <Icon name={docs[key] ? 'check' : 'image-plus'} size={16} color={docs[key] ? colors.success : colors.primary} />
                          <Text style={styles.docText}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.formSection}>Change room (optional)</Text>
                    <Text style={styles.muted}>Current: {compactLocation(t)}</Text>
                    <Text style={styles.fieldLabel}>Building</Text>
                    <View style={styles.chips}>
                      {buildings.map(item => (
                        <Chip key={item._id} label={item.buildingName} active={allocation.buildingId === item._id} onPress={() => setAllocation({ buildingId: item._id, floorId: '', roomId: '', bedId: '' })} />
                      ))}
                    </View>
                    {allocation.buildingId ? (
                      <>
                        <Text style={styles.fieldLabel}>Floor</Text>
                        <View style={styles.chips}>
                          {floors.map(item => (
                            <Chip key={item._id} label={`Floor ${item.floorNumber}`} active={allocation.floorId === item._id} onPress={() => setAllocation(p => ({ ...p, floorId: item._id, roomId: '', bedId: '' }))} />
                          ))}
                        </View>
                      </>
                    ) : null}
                    {allocation.floorId ? (
                      <>
                        <Text style={styles.fieldLabel}>Room</Text>
                        <View style={styles.chips}>
                          {rooms.map(item => (
                            <Chip key={item._id} label={`Room ${item.roomNumber}`} active={allocation.roomId === item._id} onPress={() => setAllocation(p => ({ ...p, roomId: item._id, bedId: '' }))} />
                          ))}
                        </View>
                      </>
                    ) : null}
                    {allocation.roomId ? (
                      <>
                        <Text style={styles.fieldLabel}>Bed</Text>
                        <View style={styles.chips}>
                          {availableBeds.map(item => (
                            <Chip key={item._id} label={`Bed ${item.bedNumber}`} active={allocation.bedId === item._id} onPress={() => setAllocation(p => ({ ...p, bedId: item._id }))} />
                          ))}
                        </View>
                      </>
                    ) : null}

                    <View style={styles.twoCol}>
                      <AppButton title="Cancel" icon="close" variant="secondary" style={styles.flex} onPress={() => setEditing(false)} />
                      <AppButton title="Save changes" icon="check" loading={saving} style={styles.flex} onPress={save} />
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.hero}>
                      {t.documents?.passportPhoto ? (
                        <Image source={{ uri: t.documents.passportPhoto }} style={styles.heroPhoto} />
                      ) : (
                        <View style={styles.heroFallback}><Text style={styles.heroInitial}>{t.name?.[0]?.toUpperCase()}</Text></View>
                      )}
                      <View style={styles.flex}>
                        <View style={styles.nameRow}>
                          <Text style={styles.detailName}>{t.name}</Text>
                          <View style={[styles.dot, t.status === 'Inactive' && styles.dotInactive]} />
                          <Text style={[styles.statusText, t.status === 'Inactive' && styles.statusTextInactive]}>{t.status === 'Inactive' ? 'Vacated' : 'Active'}</Text>
                        </View>
                        <Text style={styles.muted}>{t.email || 'No email'}</Text>
                        <View style={styles.contactActions}>
                          <Pressable style={styles.contactIcon} onPress={() => Linking.openURL(`tel:${t.phone}`)}>
                            <Icon name="phone" size={16} color={colors.primary} />
                          </Pressable>
                          <Pressable style={styles.contactIcon} onPress={() => Linking.openURL(`https://wa.me/91${t.phone?.replace(/\D/g, '')}`)}>
                            <Icon name="whatsapp" size={16} color={colors.primary} />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {detail.hasPreviousPending ? (
                      <View style={styles.arrearsRow}>
                        <Icon name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.arrearsText}>{detail.pendingMonthsCount} month(s) unpaid</Text>
                        <Text style={styles.arrearsAmount}>{money(detail.arrearsTotal || 0)}</Text>
                      </View>
                    ) : null}

                    <View style={styles.detailGrid}>
                      <DetailInfo label="Phone" value={t.phone} />
                      <DetailInfo label="Joining" value={dateText(t.joiningDate)} />
                      <DetailInfo label="Monthly rent" value={money(t.rentAmount || 0)} accent />
                      <DetailInfo label="Advance pending" value={money(detail.pendingAdvanceAmount ?? detail.advancePending ?? 0)} />
                      <DetailInfo label="Current status" value={current?.status || 'No record'} />
                      <DetailInfo label="Total due" value={money(detail.totalAccumulatedDue || 0)} accent />
                    </View>
                    <DetailInfo label="Allocation" value={compactLocation(t)} />
                    <DetailInfo label="Permanent address" value={t.permanentAddress} />
                    <DetailInfo label="Father" value={[t.fatherName, t.fatherPhone].filter(Boolean).join(' · ')} />

                    <Text style={styles.formSection}>Documents</Text>
                    <View style={styles.docButtons}>
                      {[['aadharFront', 'Aadhaar Front'], ['aadharBack', 'Aadhaar Back'], ['passportPhoto', 'Photo']].map(([key, label]) => (
                        <Pressable disabled={!t.documents?.[key]} key={key} style={[styles.docButton, !t.documents?.[key] && styles.disabled]} onPress={() => Linking.openURL(t.documents[key])}>
                          <Icon name="eye-outline" size={16} color={colors.primary} />
                          <Text style={styles.docText}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={styles.formSection}>Payment history</Text>
                    {(detail.history || []).length ? (detail.history || []).map((record, index) => (
                      <View style={styles.history} key={`${record.monthYear}-${index}`}>
                        <View>
                          <Text style={styles.historyMonth}>
                            {record.dueDate ? new Date(record.dueDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : record.monthYear}
                          </Text>
                          <Text style={styles.muted}>{record.status}</Text>
                        </View>
                        <Text style={styles.historyAmount}>{money(record.paidAmount || 0)}</Text>
                      </View>
                    )) : <Text style={styles.muted}>No payment history.</Text>}
                  </>
                )}
              </ScrollView>
            ) : null}
          </View>
        </KeyboardAvoid>
      </Modal>
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

  // KPI row
  kpiRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: RADIUS, paddingVertical: 12 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, color: colors.muted, marginTop: 2, fontWeight: '600' },

  // Search
  searchCard: { backgroundColor: colors.surface, borderRadius: RADIUS, padding: 10, gap: 8 },
  segmentTrack: { flexDirection: 'row', backgroundColor: colors.faint, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: colors.primary },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchIcon: { marginLeft: 2 },
  searchInput: { flex: 1, minHeight: 0 },

  // Section headers
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 6 },
  sectionTitle: { fontSize: 13, color: colors.text, fontWeight: '800' },
  sectionTitleMuted: { color: colors.muted },
  sectionCount: { fontSize: 11, color: colors.muted, fontWeight: '700' },

  // Candidate row
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderRadius: RADIUS, padding: 11 },
  rowOverdue: { borderLeftWidth: 3, borderLeftColor: colors.danger },
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
  location: { fontSize: 10.5, color: colors.primary, fontWeight: '700', marginTop: 2 },
  financeStrip: { flexDirection: 'row', gap: 16, marginTop: 7 },
  financeItem: {},
  financeLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  financeValue: { fontSize: 11.5, color: colors.text, fontWeight: '800', marginTop: 1 },
  financeDanger: { color: colors.danger },
  overdueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  overdueText: { fontSize: 10, color: colors.danger, fontWeight: '700' },

  // Detail sheet
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.55)' },
  sheet: { height: '91%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetTitle: { fontSize: 16, color: colors.text, fontWeight: '800' },
  sheetActions: { flexDirection: 'row', gap: 6 },
  actionIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { padding: 16, paddingBottom: 36, gap: 9 },

  // Hero
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 },
  heroPhoto: { width: 56, height: 56, borderRadius: 15 },
  heroFallback: { width: 56, height: 56, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontSize: 21, color: colors.primary, fontWeight: '800' },
  detailName: { fontSize: 16.5, color: colors.text, fontWeight: '800' },
  contactActions: { flexDirection: 'row', gap: 8, marginTop: 7 },
  contactIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

  arrearsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.dangerSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  arrearsText: { color: colors.danger, fontWeight: '700', fontSize: 11.5, flex: 1 },
  arrearsAmount: { color: colors.danger, fontSize: 13, fontWeight: '800' },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { backgroundColor: colors.faint, borderRadius: 10, padding: 9, minWidth: '47%', flex: 1 },
  infoLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { fontSize: 12, color: colors.text, fontWeight: '700', marginTop: 3 },

  formSection: { fontSize: 11, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', marginTop: 6, marginBottom: 2 },
  twoCol: { flexDirection: 'row', gap: 9 },
  docButtons: { flexDirection: 'row', gap: 7 },
  docButton: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: colors.faint },
  docSelected: { backgroundColor: colors.successSoft },
  docText: { fontSize: 9, color: colors.text, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.faint },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 10.5, color: colors.text, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 9, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', marginTop: 4, marginBottom: 4 },

  history: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  historyMonth: { fontSize: 12, color: colors.text, fontWeight: '700' },
  historyAmount: { fontSize: 12, color: colors.success, fontWeight: '800' },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});

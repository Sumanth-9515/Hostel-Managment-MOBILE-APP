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
import ProfileImagePopup from '../../components/ProfileImagePopup';
import { buildingApi } from '../../api/buildingApi';
import { rentApi } from '../../api/rentApi';
import { tenantApi } from '../../api/tenantApi';
import { colors } from '../../utils/constants';
import { advancePendingFor, compactLocation, dateText, getMessage, money } from '../../utils/helpers';

const tenantDetailCache = new Map();

const monthText = value => value
  ? new Date(value).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
  : 'Current month';

const paymentDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const paymentsForRecord = record =>
  Array.isArray(record?.payments)
    ? record.payments
    : Array.isArray(record?.paymentHistory)
      ? record.paymentHistory
      : [];

const statusTone = {
  Paid: { fg: colors.success, bg: colors.successSoft },
  Partial: { fg: colors.warning, bg: colors.accentSoft },
  Due: { fg: colors.danger, bg: colors.dangerSoft },
};

function StatusPill({ status }) {
  if (!status) return null;
  const tone = statusTone[status] || statusTone.Due;
  return <Text style={[styles.pill, { color: tone.fg, backgroundColor: tone.bg }]}>{status}</Text>;
}

function Info({ label, value, accent }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
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
          <View style={styles.twoCol}>
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

function TenantDataSkeleton() {
  return (
    <View pointerEvents="none">
      <View style={styles.skeletonCard}>
        <View style={styles.hero}>
          <View style={[styles.skeletonBlock, { width: 60, height: 60, borderRadius: 16 }]} />
          <View style={styles.flex}>
            <View style={[styles.skeletonBlock, { width: '50%', height: 16 }]} />
            <View style={[styles.skeletonBlock, { width: '40%', height: 11, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '30%', height: 10, marginTop: 6 }]} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={[styles.skeletonBlock, { width: 38, height: 38, borderRadius: 10 }]} />
          <View style={[styles.skeletonBlock, { width: 38, height: 38, borderRadius: 10 }]} />
        </View>
      </View>
      <View style={styles.skeletonCard}>
        <View style={[styles.skeletonBlock, { width: '40%', height: 11, marginBottom: 12 }]} />
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[styles.info, { minHeight: 48, marginBottom: 8 }]}>
              <View style={[styles.skeletonBlock, { width: '50%', height: 8 }]} />
              <View style={[styles.skeletonBlock, { width: '70%', height: 11, marginTop: 4 }]} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function TenantDetailsScreen({ navigation, route }) {
  const { tenantId } = route.params || {};
  const [detail, setDetail] = useState(tenantDetailCache.get(tenantId) || null);
  const [dataLoading, setDataLoading] = useState(!tenantDetailCache.has(tenantId));
  const [dataError, setDataError] = useState(null);
  const [buildings, setBuildings] = useState([]);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [docs, setDocs] = useState({});
  const [allocation, setAllocation] = useState({ buildingId: '', floorId: '', roomId: '', bedId: '' });
  const [availableBeds, setAvailableBeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [vacating, setVacating] = useState(false);
  const [changeRoomOpen, setChangeRoomOpen] = useState(false);
  const [changingRoom, setChangingRoom] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const hasLoadedRef = useRef(tenantDetailCache.has(tenantId));
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    if (!tenantId) return;
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const data = await rentApi.tenant(tenantId);
      if (requestId !== loadRequestRef.current) return;
      setDetail(data);
      tenantDetailCache.set(tenantId, data);
      const t = data.tenant || {};
      setEditForm({
        name: t.name || '', phone: t.phone || '', email: t.email || '',
        fatherName: t.fatherName || '', fatherPhone: t.fatherPhone || '',
        permanentAddress: t.permanentAddress || '', joiningDate: t.joiningDate?.slice(0, 10) || '',
        rentAmount: String(t.rentAmount || ''), advanceAmount: String(t.advanceAmount || ''),
      });
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
      }
    }
  }, [tenantId]);

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || tenantDetailCache.has(tenantId) })
      .then(() => { hasLoadedRef.current = true; });
  }, [load, tenantId]));

  useEffect(() => { buildingApi.list().then(d => setBuildings(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const selectedBuilding = buildings.find(b => b._id === allocation.buildingId);
  const floors = useMemo(() => [...(selectedBuilding?.floors || [])].sort((a, b) => a.floorNumber - b.floorNumber), [selectedBuilding]);
  const selectedFloor = floors.find(f => f._id === allocation.floorId);
  const rooms = selectedFloor?.rooms || [];

  useEffect(() => {
    if (!allocation.buildingId || !allocation.floorId || !allocation.roomId) { setAvailableBeds([]); return; }
    buildingApi.availableBeds(allocation.buildingId, allocation.floorId, allocation.roomId)
      .then(d => setAvailableBeds(d.availableBeds || []))
      .catch(() => setAvailableBeds([]));
  }, [allocation.buildingId, allocation.floorId, allocation.roomId]);

  const beginEdit = () => { setEditing(true); setDocs({}); setAllocation({ buildingId: '', floorId: '', roomId: '', bedId: '' }); };
  const openChangeRoom = () => {
    setAllocation({ buildingId: '', floorId: '', roomId: '', bedId: '' });
    setChangeRoomOpen(true);
  };

  const pickDoc = key => launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, result => {
    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    if (Number(asset.fileSize || 0) > 5 * 1024 * 1024) return Alert.alert('File too large', 'Select an image smaller than 5 MB.');
    setDocs(prev => ({ ...prev, [key]: { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || `${key}.jpg` } }));
  });

  const save = async () => {
    const t = detail?.tenant;
    if (!t) return;
    if (!editForm.name.trim()) return Alert.alert('Name required', 'Enter the tenant name.');
    if (!Number(editForm.rentAmount)) return Alert.alert('Rent required', 'Enter a valid monthly rent.');
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([key, value]) => fd.append(key, key === 'advanceAmount' ? String(Number(value || 0)) : value));
      Object.entries(docs).forEach(([key, file]) => fd.append(key, file));
      await tenantApi.update(t._id, fd);
      setEditing(false);
      await load();
    } catch (error) {
      Alert.alert('Update failed', getMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const vacate = () => Alert.alert('Vacate tenant?', `${detail?.tenant?.name} will be marked inactive and their bed will be freed. This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Vacate', style: 'destructive', onPress: async () => {
      setVacating(true);
      try {
        await tenantApi.vacate(detail.tenant._id);
        navigation.goBack();
      } catch (error) {
        Alert.alert('Vacate failed', getMessage(error));
      } finally {
        setVacating(false);
      }
    } },
  ]);

  const selectedRoom = rooms.find(r => r._id === allocation.roomId);
  const selectedBed = availableBeds.find(b => b._id === allocation.bedId);
  const selectedLocation = [
    selectedBuilding?.buildingName,
    selectedFloor ? `Floor ${selectedFloor.floorNumber}` : '',
    selectedRoom ? `Room ${selectedRoom.roomNumber}` : '',
    selectedBed ? `Bed ${selectedBed.bedNumber}` : '',
  ].filter(Boolean).join(' / ');

  const saveRoomChange = () => {
    const tenant = detail?.tenant;
    if (!tenant) return;
    if (!allocation.buildingId || !allocation.floorId || !allocation.roomId || !allocation.bedId) {
      return Alert.alert('Select full location', 'Please select building, floor, room and available bed.');
    }
    Alert.alert('Confirm room change', `${tenant.name} is room changing to ${selectedLocation}. Are you want to save?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          setChangingRoom(true);
          try {
            await tenantApi.reallocate(tenant._id, allocation);
            setChangeRoomOpen(false);
            setAllocation({ buildingId: '', floorId: '', roomId: '', bedId: '' });
            await load();
            Alert.alert('Room changed', `${tenant.name} moved to ${selectedLocation}.`);
          } catch (error) {
            Alert.alert('Room change failed', getMessage(error));
          } finally {
            setChangingRoom(false);
          }
        },
      },
    ]);
  };

  const correctPayment = async payload => {
    await rentApi.paymentCorrection(payload);
    setEditingPayment(null);
    await load();
  };

  const hasData = detail !== null;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  const t = detail?.tenant;
  const current = detail?.currentRecord;
  const photo = t?.documents?.passportPhoto;
  const inactive = t?.status === 'Inactive';
  const advanceExpected = Number(t?.advanceAmount || 0);
  const advancePaid = Number(t?.paidAdvanceAmount ?? t?.paidadvanceAmount ?? 0);
  const advancePending = t ? advancePendingFor({ tenant: t }) : 0;

  return (
    <View style={styles.screen}>
      <AppHeader title="Full Tenant Details" subtitle={t?.name || 'Loading details'} onBack={() => navigation.goBack()} />
      <KeyboardAvoid style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {showSkeleton ? (
            <TenantDataSkeleton />
          ) : showError ? (
            <EmptyState title="Unable to load details" message={dataError} icon="wifi-alert" />
          ) : t ? (
            <>
              {/* Hero */}
              <AppCard>
                <View style={styles.hero}>
                  {photo ? (
                    <Pressable onPress={() => setShowPhoto(true)}><Image source={{ uri: photo }} style={styles.heroPhoto} /></Pressable>
                  ) : (
                    <View style={styles.heroFallback}><Text style={styles.heroInitial}>{t.name?.[0]?.toUpperCase()}</Text></View>
                  )}
                  <View style={styles.flex}>
                    <Text style={styles.heroName}>{t.name}</Text>
                    <Text style={styles.muted}>{t.email || 'No email on record'}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.dot, inactive && styles.dotInactive]} />
                      <Text style={[styles.statusText, inactive && styles.statusTextInactive]}>{inactive ? 'Vacated' : 'Active'}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.contactRow}>
                  <Pressable style={styles.contactIcon} onPress={() => Linking.openURL(`tel:${t.phone}`).catch(() => {})}><Icon name="phone" size={17} color={colors.primary} /></Pressable>
                  <Pressable style={styles.contactIcon} onPress={() => Linking.openURL(`https://wa.me/91${t.phone?.replace(/\D/g, '')}`).catch(() => {})}><Icon name="whatsapp" size={17} color={colors.success} /></Pressable>
                  {!editing && !inactive ? (
                    <>
                      <Pressable style={[styles.headerBtn, { backgroundColor: colors.primarySoft }]} onPress={beginEdit}>
                        <Icon name="pencil-outline" size={15} color={colors.primary} />
                        <Text style={[styles.headerBtnText, { color: colors.primary }]}>Edit</Text>
                      </Pressable>
                      <Pressable style={[styles.headerBtn, { backgroundColor: colors.dangerSoft }]} onPress={vacate} disabled={vacating}>
                        <Icon name="logout" size={15} color={colors.danger} />
                        <Text style={[styles.headerBtnText, { color: colors.danger }]}>{vacating ? 'Vacating…' : 'Vacate'}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </AppCard>

              {editing ? (
                <AppCard>
                  <Text style={styles.section}>Basic information</Text>
                  <AppInput label="Full name" value={editForm.name} onChangeText={v => setEditForm(p => ({ ...p, name: v }))} />
                  <View style={styles.twoCol}>
                    <View style={styles.flex}><AppInput label="Phone" value={editForm.phone} onChangeText={v => /^\d{0,10}$/.test(v) && setEditForm(p => ({ ...p, phone: v }))} keyboardType="phone-pad" /></View>
                    <View style={styles.flex}><AppInput label="Email" value={editForm.email} onChangeText={v => setEditForm(p => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" /></View>
                  </View>
                  <View style={styles.twoCol}>
                    <View style={styles.flex}><AppInput label="Monthly rent" value={editForm.rentAmount} onChangeText={v => setEditForm(p => ({ ...p, rentAmount: v }))} keyboardType="numeric" /></View>
                    <View style={styles.flex}><AppInput label="Advance amount" value={editForm.advanceAmount} onChangeText={v => setEditForm(p => ({ ...p, advanceAmount: v }))} keyboardType="numeric" /></View>
                  </View>
                  <AppInput label="Joining date (YYYY-MM-DD)" value={editForm.joiningDate} onChangeText={v => setEditForm(p => ({ ...p, joiningDate: v }))} />
                  <AppInput label="Permanent address" value={editForm.permanentAddress} onChangeText={v => setEditForm(p => ({ ...p, permanentAddress: v }))} multiline />
                  <View style={styles.twoCol}>
                    <View style={styles.flex}><AppInput label="Father's name" value={editForm.fatherName} onChangeText={v => setEditForm(p => ({ ...p, fatherName: v }))} /></View>
                    <View style={styles.flex}><AppInput label="Father's phone" value={editForm.fatherPhone} onChangeText={v => /^\d{0,10}$/.test(v) && setEditForm(p => ({ ...p, fatherPhone: v }))} keyboardType="phone-pad" /></View>
                  </View>

                  <Text style={styles.section}>Replace / Reupload documents</Text>
                  <View style={styles.docButtons}>
                    {[['aadharFront', 'Aadhaar Front'], ['aadharBack', 'Aadhaar Back'], ['passportPhoto', 'Photo']].map(([key, label]) => (
                      <Pressable key={key} style={[styles.docButton, docs[key] && styles.docSelected]} onPress={() => pickDoc(key)}>
                        <Icon name={docs[key] ? 'check' : 'image-plus'} size={16} color={docs[key] ? colors.success : colors.primary} />
                        <Text style={styles.docText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
               


                  <Text style={styles.section}>Click to Change room</Text>
                  <Text style={styles.muted}>Current: {compactLocation(t)}</Text>
                  <Pressable style={[styles.changeRoomEditBtn, { backgroundColor: colors.infoSoft }]} onPress={openChangeRoom}>
                    <Icon name="swap-horizontal" size={16} color={colors.info} />
                    <Text style={[styles.headerBtnText, { color: colors.info }]}>Change Room</Text>
                  </Pressable>

                  <View style={[styles.twoCol, styles.saveRow]}>
                    <AppButton title="Cancel" icon="close" variant="secondary" style={styles.flex} onPress={() => setEditing(false)} />
                    <AppButton title="Save changes" icon="check" loading={saving} style={styles.flex} onPress={save} />
                  </View>
                </AppCard>
              ) : (
                <>
                  {/* All DB fields */}
                  <AppCard>
                    <Text style={styles.section}>Tenant information</Text>
                    <View style={styles.grid}>
                      <Info label="Phone" value={t.phone} />
                      <Info label="Email" value={t.email} />
                      <Info label="Joining date" value={dateText(t.joiningDate)} />
                      <Info label="Monthly rent" value={money(t.rentAmount || 0)} accent />
                      <Info label="Father's name" value={t.fatherName} />
                      <Info label="Father's phone" value={t.fatherPhone} />
                      <Info label="Current status" value={current?.status || 'No record'} />
                      <Info label="Tenant status" value={t.status} />
                    </View>
                    <Info label="Permanent address" value={t.permanentAddress} />
                    <Info label="Allocation" value={compactLocation(t)} accent />
                  </AppCard>

                  {/* Advance + dues */}
                  <AppCard>
                    <Text style={styles.section}>Financials</Text>
                    <View style={styles.grid}>
                      <Info label="Advance expected" value={money(advanceExpected)} />
                      <Info label="Advance paid" value={money(advancePaid)} />
                      <Info label="Advance pending" value={money(advancePending)} accent={advancePending > 0} />
                      <Info label="Total due" value={money(detail.totalAccumulatedDue || 0)} accent />
                    </View>
                    {detail.hasPreviousPending ? (
                      <View style={styles.arrears}>
                        <Icon name="alert-circle" size={15} color={colors.danger} />
                        <Text style={styles.arrearsText}>{detail.pendingMonthsCount} month(s) unpaid</Text>
                        <Text style={styles.arrearsAmount}>{money(detail.arrearsTotal || 0)}</Text>
                      </View>
                    ) : null}
                  </AppCard>

                  {/* Documents */}
                  {(t.documents?.aadharFront || t.documents?.aadharBack || t.documents?.passportPhoto) ? (
                    <AppCard>
                      <Text style={styles.section}>Documents</Text>
                      <View style={styles.docButtons}>
                        {[['aadharFront', 'Aadhaar Front'], ['aadharBack', 'Aadhaar Back'], ['passportPhoto', 'Photo']].map(([key, label]) => (
                          <Pressable disabled={!t.documents?.[key]} key={key} style={[styles.docButton, !t.documents?.[key] && styles.disabled]} onPress={() => Linking.openURL(t.documents[key])}>
                            <Icon name="eye-outline" size={16} color={colors.primary} />
                            <Text style={styles.docText}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </AppCard>
                  ) : null}

                  {/* Payment history with correction */}
                  <AppCard>
                    <Text style={styles.section}>Payment history</Text>
                    {(detail.history || []).length ? detail.history.map((record, index) => (
                      <View style={styles.history} key={`${record.monthYear}-${index}`}>
                        <View style={styles.flex}>
                          <Text style={styles.historyMonth}>{monthText(record.dueDate)}</Text>
                          <Text style={styles.muted}>{money(record.paidAmount || 0)} / {money(record.rentAmount || 0)}{record.note ? ` · ${record.note}` : ''}</Text>
                          {paymentsForRecord(record).length ? (
                            <View style={styles.paymentTimeList}>
                              {paymentsForRecord(record).map((payment, paymentIndex) => (
                                <View style={styles.paymentTimeRow} key={payment._id || `${record.monthYear}-${paymentIndex}`}>
                                  <View style={styles.paymentTimeIcon}>
                                    <Icon name="clock-check-outline" size={12} color={colors.success} />
                                  </View>
                                  <Text style={styles.paymentTimeText}>{money(payment.amount || 0)}</Text>
                                  <Text style={styles.paymentTimeDate}>{paymentDateTime(payment.paidAt) || 'time not available'}</Text>
                                </View>
                              ))}
                            </View>
                          ) : null}
                        </View>
                        <StatusPill status={record.status} />
                        {Number(record.paidAmount || 0) > 0 ? (
                          <Pressable style={styles.editPayBtn} onPress={() => setEditingPayment(record)}>
                            <Text style={styles.editPayText}>Edit</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )) : <Text style={styles.muted}>No payment history yet.</Text>}
                  </AppCard>
                </>
              )}
            </>
          ) : null}
          <View style={styles.footer} />
        </ScrollView>
      </KeyboardAvoid>

      {editingPayment ? <EditPaymentModal record={editingPayment} onClose={() => setEditingPayment(null)} onSave={correctPayment} /> : null}
      <Modal visible={changeRoomOpen} transparent animationType="slide" onRequestClose={() => setChangeRoomOpen(false)}>
        <KeyboardAvoid modal style={styles.centerBackdrop}>
          <View style={styles.roomModal}>
            <View style={styles.modalHead}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIcon}>
                  <Icon name="swap-horizontal" size={18} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.modalTitle}>Change Room</Text>
                  <Text style={styles.muted}>Current: {t ? compactLocation(t) : '-'}</Text>
                </View>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setChangeRoomOpen(false)}>
                <Icon name="close" size={21} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.roomPickerBody}>
              <Text style={styles.fieldLabel}>Building</Text>
              <View style={styles.chips}>
                {buildings.map(b => <Chip key={b._id} label={b.buildingName} active={allocation.buildingId === b._id} onPress={() => setAllocation({ buildingId: b._id, floorId: '', roomId: '', bedId: '' })} />)}
              </View>

              {allocation.buildingId ? (
                <>
                  <Text style={styles.fieldLabel}>Floor</Text>
                  <View style={styles.chips}>{floors.map(f => <Chip key={f._id} label={`Floor ${f.floorNumber}`} active={allocation.floorId === f._id} onPress={() => setAllocation(p => ({ ...p, floorId: f._id, roomId: '', bedId: '' }))} />)}</View>
                </>
              ) : null}

              {allocation.floorId ? (
                <>
                  <Text style={styles.fieldLabel}>Room</Text>
                  <View style={styles.chips}>{rooms.map(r => <Chip key={r._id} label={`Room ${r.roomNumber}`} active={allocation.roomId === r._id} onPress={() => setAllocation(p => ({ ...p, roomId: r._id, bedId: '' }))} />)}</View>
                </>
              ) : null}

              {allocation.roomId ? (
                <>
                  <Text style={styles.fieldLabel}>Available bed</Text>
                  <View style={styles.chips}>
                    {availableBeds.length ? availableBeds.map(b => <Chip key={b._id} label={`Bed ${b.bedNumber}`} active={allocation.bedId === b._id} onPress={() => setAllocation(p => ({ ...p, bedId: b._id }))} />) : <Text style={styles.muted}>No available beds in this room.</Text>}
                  </View>
                </>
              ) : null}

              <View style={styles.roomSummary}>
                <Icon name={allocation.bedId ? 'check-decagram-outline' : 'map-marker-radius-outline'} size={20} color={allocation.bedId ? colors.success : colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.roomSummaryTitle}>{allocation.bedId ? 'New location selected' : 'Select new room location'}</Text>
                  <Text style={styles.muted}>{selectedLocation || 'Building / Floor / Room / Bed'}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <AppButton title="Cancel" icon="close" variant="secondary" style={styles.flex} onPress={() => setChangeRoomOpen(false)} />
              <AppButton title="Save Room" icon="check" loading={changingRoom} style={styles.flex} onPress={saveRoomChange} />
            </View>
          </View>
        </KeyboardAvoid>
      </Modal>
      <ProfileImagePopup visible={showPhoto} imageUrl={photo} name={t?.name} onClose={() => setShowPhoto(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  body: { padding: 16 },
  footer: { height: 40 },
  muted: { fontSize: 12, color: colors.muted, marginTop: 3 },
  section: { fontSize: 12, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10 },

  hero: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroPhoto: { width: 60, height: 60, borderRadius: 16 },
  heroFallback: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  heroInitial: { fontSize: 24, color: colors.primary, fontWeight: '900' },
  heroName: { fontSize: 19, color: colors.text, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  dotInactive: { backgroundColor: colors.danger },
  statusText: { fontSize: 11, color: colors.success, fontWeight: '800' },
  statusTextInactive: { color: colors.danger },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  contactIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  changeRoomEditBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  headerBtnText: { fontSize: 12, fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  info: { backgroundColor: colors.faint, borderRadius: 10, padding: 10, minWidth: '47%', flex: 1, marginBottom: 8 },
  infoLabel: { fontSize: 9, color: colors.muted, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 3 },
  pill: { fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },

  arrears: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.dangerSoft, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 11, marginTop: 4 },
  arrearsText: { color: colors.danger, fontWeight: '800', fontSize: 12, flex: 1 },
  arrearsAmount: { color: colors.danger, fontSize: 14, fontWeight: '900' },

  docButtons: { flexDirection: 'row', gap: 8 },
  docButton: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.faint },
  docSelected: { backgroundColor: colors.successSoft },
  docText: { fontSize: 9, color: colors.text, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.4 },

  twoCol: { flexDirection: 'row', gap: 9 },
  saveRow: { marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.faint },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, color: colors.text, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 9, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },

  history: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  historyMonth: { fontSize: 13, color: colors.text, fontWeight: '800' },
  paymentTimeList: { gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.faint },
  paymentTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.successSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  paymentTimeIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  paymentTimeText: { color: colors.success, fontSize: 11, fontWeight: '900' },
  paymentTimeDate: { color: colors.text, fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'right' },
  editPayBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.infoSoft },
  editPayText: { fontSize: 11, color: colors.info, fontWeight: '800' },

  centerBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17,24,39,0.5)' },
  centerModal: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, gap: 4 },
  roomModal: { maxHeight: '88%', backgroundColor: colors.surface, borderRadius: 22, padding: 18 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  modalClose: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  roomPickerBody: { paddingTop: 8, paddingBottom: 8 },
  roomSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.faint, marginTop: 14 },
  roomSummaryTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 9, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.faint },
  miniBox: { flex: 1, backgroundColor: colors.faint, borderRadius: 10, padding: 11, marginVertical: 8 },
  miniLabel: { fontSize: 10, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  miniValue: { fontSize: 14, color: colors.text, fontWeight: '900', marginTop: 3 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
  skeletonCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 12 },
});

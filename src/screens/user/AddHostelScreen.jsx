import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import { useSidebar } from '../../components/Sidebar';
import { buildingApi } from '../../api/buildingApi';
import { tenantApi } from '../../api/tenantApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage, money } from '../../utils/helpers';

const SHARE_OPTIONS = [1, 2, 3, 4, 5, 6];
const emptyBuilding = { buildingName: '', address: '' };
const emptyFloor = { floorNumber: '', floorName: '' };
const emptyRoom = { roomNumber: '', shareType: '2' };

const counts = building => {
  const floors = building?.floors || [];
  const rooms = floors.flatMap(floor => floor.rooms || []);
  const beds = rooms.flatMap(room => room.beds || []);
  return { floors: floors.length, rooms: rooms.length, beds: beds.length, occupied: beds.filter(bed => bed.status === 'Occupied').length };
};

const hostelCache = {
  hasData: false,
  buildings: [],
  usage: null,
};

function Sheet({ visible, title, subtitle, icon, onClose, children, tall = false }) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [mounted, progress, visible]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoid modal style={styles.backdrop}>
        <Animated.View style={[styles.sheet, tall && styles.tallSheet, {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}>
          <View style={styles.sheetHead}>
            <View style={styles.sheetIcon}><Icon name={icon} size={22} color="#fff" /></View>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSub}>{subtitle}</Text> : null}
            </View>
            <Pressable style={styles.close} onPress={onClose}><Icon name="close" size={21} color={colors.muted} /></Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoid>
    </Modal>
  );
}

function StatItem({ label, value }) {
  return <View style={styles.statItem}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function IconAction({ icon, color, onPress, label }) {
  return <Pressable accessibilityLabel={label} style={styles.iconAction} onPress={event => { event.stopPropagation(); onPress(); }}><Icon name={icon} size={18} color={color} /></Pressable>;
}

function HostelDataSkeleton() {
  return (
    <View pointerEvents="none">
      <View style={styles.usage}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={[styles.skeletonBlock, { width: 19, height: 19 }]} />
          <View style={styles.flex}>
            <View style={[styles.skeletonBlock, { width: '50%', height: 12 }]} />
            <View style={[styles.skeletonBlock, { width: '40%', height: 10, marginTop: 4 }]} />
          </View>
          <View style={[styles.skeletonBlock, { width: 28, height: 14 }]} />
        </View>
        <View style={[styles.skeletonBlock, { width: '100%', height: 5, borderRadius: 6, marginTop: 8 }]} />
      </View>
      <View style={styles.stats}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={styles.statItem}>
            <View style={[styles.skeletonBlock, { width: 30, height: 18 }]} />
            <View style={[styles.skeletonBlock, { width: 44, height: 9, marginTop: 4 }]} />
          </View>
        ))}
      </View>
      <View style={styles.divider} />
      <View style={[styles.skeletonBlock, { width: 100, height: 16, marginBottom: 8 }]} />
      {[0, 1].map(i => (
        <View key={i} style={styles.propertyCard}>
          <View style={styles.propertyTop}>
            <View style={[styles.skeletonBlock, { width: 36, height: 36, borderRadius: 16 }]} />
            <View style={styles.flex}>
              <View style={[styles.skeletonBlock, { width: '50%', height: 14 }]} />
              <View style={[styles.skeletonBlock, { width: '40%', height: 10, marginTop: 4 }]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, { width: '60%', height: 11, marginTop: 9 }]} />
        </View>
      ))}
    </View>
  );
}

export default function AddHostelScreen({ onLogout }) {
  const { open } = useSidebar();
  const [dataLoading, setDataLoading] = useState(!hostelCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [buildings, setBuildings] = useState(hostelCache.buildings);
  const [usage, setUsage] = useState(hostelCache.usage);
  const [building, setBuilding] = useState(null);
  const [floor, setFloor] = useState(null);
  const [room, setRoom] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [level, setLevel] = useState(null);
  const [formType, setFormType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [bForm, setBForm] = useState(emptyBuilding);
  const [fForm, setFForm] = useState(emptyFloor);
  const [rForm, setRForm] = useState(emptyRoom);
  const [saving, setSaving] = useState(false);
  const [planInfo, setPlanInfo] = useState(null);
  const [overflowBuilding, setOverflowBuilding] = useState(null);

  const hasLoadedRef = useRef(hostelCache.hasData);
  const loadRequestRef = useRef(0);

  const refresh = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [list, bedUsage] = await Promise.all([buildingApi.list(), buildingApi.bedUsage().catch(() => null)]);
      if (requestId !== loadRequestRef.current) return;
      const safeList = Array.isArray(list) ? list : [];
      setBuildings(safeList);
      setUsage(bedUsage);
      if (building?._id) {
        const freshBuilding = safeList.find(item => item._id === building._id);
        setBuilding(freshBuilding || null);
        if (freshBuilding && floor?._id) {
          const freshFloor = freshBuilding.floors?.find(item => item._id === floor._id);
          setFloor(freshFloor || null);
          if (freshFloor && room?._id) setRoom(freshFloor.rooms?.find(item => item._id === room._id) || null);
        }
      }

      hostelCache.hasData = true;
      hostelCache.buildings = safeList;
      hostelCache.usage = bedUsage;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
      }
    }
  }, [building?._id, floor?._id, room?._id]);

  useFocusEffect(useCallback(() => {
    refresh({ background: hasLoadedRef.current || hostelCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [refresh]));

  const totals = useMemo(() => buildings.reduce((sum, item) => {
    const c = counts(item);
    return { buildings: sum.buildings + 1, floors: sum.floors + c.floors, rooms: sum.rooms + c.rooms, beds: sum.beds + c.beds, occupied: sum.occupied + c.occupied };
  }, { buildings: 0, floors: 0, rooms: 0, beds: 0, occupied: 0 }), [buildings]);

  const showPlanError = error => {
    const data = error?.response?.data || {};
    setPlanInfo({ bedLimit: data.bedLimit ?? usage?.bedLimit ?? 0, usedBeds: data.usedBeds ?? usage?.usedBeds ?? 0, remainingBeds: data.remainingBeds ?? usage?.remainingBeds ?? 0 });
  };

  const openBuildingForm = item => {
    setOverflowBuilding(null);
    setEditing(item || null);
    setBForm(item ? { buildingName: item.buildingName, address: item.address || '' } : emptyBuilding);
    setFormType('building');
  };
  const openFloorForm = item => {
    setEditing(item || null);
    setFForm(item ? { floorNumber: String(item.floorNumber), floorName: item.floorName || '' } : emptyFloor);
    setFormType('floor');
  };
  const openRoomForm = item => {
    setEditing(item || null);
    setRForm(item ? { roomNumber: String(item.roomNumber), shareType: String(item.shareType) } : emptyRoom);
    setFormType('room');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (formType === 'building') {
        if (!bForm.buildingName.trim()) throw new Error('Building name is required.');
        if (editing) await buildingApi.update(editing._id, bForm); else await buildingApi.create(bForm);
      } else if (formType === 'floor') {
        if (!fForm.floorNumber) throw new Error('Floor number is required.');
        const payload = { floorNumber: Number(fForm.floorNumber), floorName: fForm.floorName };
        if (editing) await buildingApi.updateFloor(building._id, editing._id, payload); else await buildingApi.addFloor(building._id, payload);
      } else if (formType === 'room') {
        if (!rForm.roomNumber.trim()) throw new Error('Room number is required.');
        const payload = { roomNumber: rForm.roomNumber, shareType: Number(rForm.shareType) };
        if (editing) await buildingApi.updateRoom(building._id, floor._id, editing._id, payload); else await buildingApi.addRoom(building._id, floor._id, payload);
      }
      setFormType(null); setEditing(null); await refresh();
    } catch (error) {
      if (error?.response?.data?.planLimitExceeded) { setFormType(null); showPlanError(error); }
      else Alert.alert('Unable to save', getMessage(error));
    } finally { setSaving(false); }
  };

  const confirmDelete = (title, message, action) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await action(); await refresh(); } catch (error) { Alert.alert('Delete failed', getMessage(error)); } } },
  ]);

  const openBuildingDetails = item => {
    setOverflowBuilding(null);
    setBuilding(item);
    setFloor(null);
    setRoom(null);
    setLevel('floors');
  };

  const addBed = async () => {
    if (usage?.bedLimit != null && usage.remainingBeds === 0) return setPlanInfo(usage);
    try {
      await buildingApi.updateRoom(building._id, floor._id, room._id, { roomNumber: room.roomNumber, shareType: (room.beds?.length || 0) + 1 });
      await refresh();
    } catch (error) { if (error?.response?.data?.planLimitExceeded) showPlanError(error); else Alert.alert('Unable to add bed', getMessage(error)); }
  };

  const removeBed = bed => {
    if (bed.status === 'Occupied') return Alert.alert('Occupied bed', 'An occupied bed cannot be removed.');
    if ((room.beds?.length || 0) <= 1) return Alert.alert('Bed required', 'A room must have at least one bed.');
    confirmDelete('Remove bed?', `Remove Bed ${bed.bedNumber}?`, () => buildingApi.updateRoom(building._id, floor._id, room._id, { roomNumber: room.roomNumber, shareType: room.beds.length - 1 }));
  };

  const openBed = async bed => {
    if (bed.status !== 'Occupied' || !bed.tenantId) return;
    try {
      const id = typeof bed.tenantId === 'object' ? bed.tenantId._id : bed.tenantId;
      setTenant(typeof bed.tenantId === 'object' && bed.tenantId.name ? bed.tenantId : await tenantApi.get(id));
    } catch (error) { Alert.alert('Tenant details', getMessage(error)); }
  };

  const hasData = hostelCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  const pct = usage?.bedLimit ? Math.min(100, Math.round((usage.usedBeds / usage.bedLimit) * 100)) : 0;

  return (
    <View style={styles.screen}>
      <AppHeader title="My Hostels" subtitle="Buildings, floors, rooms and beds" onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      {showSkeleton ? (
        <ScrollView contentContainerStyle={styles.body}>
          <HostelDataSkeleton />
        </ScrollView>
      ) : showError ? (
        <EmptyState title="Unable to load hostels" message={dataError} icon="wifi-alert" />
      ) : (
        <FlatList data={buildings} keyExtractor={item => item._id} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}
          ListHeaderComponent={<>
            {usage?.bedLimit != null ? <View style={[styles.usage, usage.remainingBeds === 0 && styles.usageFull]}>
              <View style={styles.row}><Icon name="bed-outline" size={19} color={usage.remainingBeds === 0 ? colors.danger : colors.primary} /><View style={styles.flex}><Text style={styles.usageTitle}>{usage.remainingBeds === 0 ? 'Bed limit reached' : `${usage.remainingBeds} beds remaining`}</Text><Text style={styles.muted}>{usage.usedBeds} of {usage.bedLimit} beds used</Text></View><Text style={[styles.usagePct, usage.remainingBeds === 0 && styles.limitPct]}>{pct}%</Text></View>
              <View style={styles.track}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: usage.remainingBeds === 0 ? colors.danger : colors.primary }]} /></View>
            </View> : null}
            <View style={styles.stats}><StatItem label="Buildings" value={totals.buildings} /><StatItem label="Floors" value={totals.floors} /><StatItem label="Rooms" value={totals.rooms} /><StatItem label="Beds" value={totals.beds} /></View>
            <View style={styles.divider} />
            <View style={styles.sectionHead}><View><Text style={styles.heading}>Properties</Text><Text style={styles.muted}>Tap any building to manage floors, rooms and beds</Text></View></View>
          </>}
          ListEmptyComponent={<EmptyState title="No buildings yet" message="Create your first hostel building." icon="office-building-outline" />}
          renderItem={({ item }) => { const c = counts(item); const menuOpen = overflowBuilding?._id === item._id; return <Pressable style={styles.propertyCard} onPress={() => openBuildingDetails(item)}>
            <View style={styles.propertyTop}><View style={styles.buildingIcon}><Icon name="office-building" size={19} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.buildingName}>{item.buildingName}</Text><Text style={styles.muted} numberOfLines={1}>{item.address || 'No address'}</Text></View><Pressable accessibilityLabel="Building actions" style={styles.moreButton} onPress={event => { event.stopPropagation(); setOverflowBuilding(menuOpen ? null : item); }}><Icon name="dots-horizontal" size={20} color={colors.muted} /></Pressable></View>
            <Text style={styles.metadata}>{c.floors} Floors • {c.rooms} Rooms • {c.beds} Beds • {c.occupied} Occupied</Text>
            <View style={styles.cardFoot}><Text style={styles.viewDetails}>View Details →</Text></View>
            {menuOpen ? <View style={styles.overflowMenu}><Pressable style={styles.menuItem} onPress={event => { event.stopPropagation(); openBuildingForm(item); }}><Icon name="pencil-outline" size={17} color={colors.primary} /><Text style={styles.menuText}>Edit</Text></Pressable><Pressable style={styles.menuItem} onPress={event => { event.stopPropagation(); setOverflowBuilding(null); confirmDelete('Delete building?', 'This will delete all floors, rooms and beds.', () => buildingApi.remove(item._id)); }}><Icon name="delete-outline" size={17} color={colors.danger} /><Text style={[styles.menuText, styles.deleteText]}>Delete</Text></Pressable></View> : null}
          </Pressable>; }}
          ListFooterComponent={<View style={styles.footerSpace} />}
        />
      )}

      <Sheet visible={!!level} title={level === 'beds' ? `Room ${room?.roomNumber || ''}` : level === 'rooms' ? 'Rooms' : 'Floors'} subtitle={level === 'beds' ? `${room?.shareType || 0}-share bed details` : level === 'rooms' ? `Floor ${floor?.floorNumber || ''}` : building?.buildingName} icon={level === 'beds' ? 'bed-outline' : level === 'rooms' ? 'door-open' : 'layers-outline'} tall onClose={() => setLevel(level === 'beds' ? 'rooms' : level === 'rooms' ? 'floors' : null)}>
        {level === 'floors' ? <>
          <View style={styles.sheetAction}><AppButton title="Add Floor" icon="plus" onPress={() => openFloorForm(null)} /></View>
          <ScrollView contentContainerStyle={styles.sheetList}>{(building?.floors || []).length ? [...building.floors].sort((a, b) => a.floorNumber - b.floorNumber).map(item => <Pressable key={item._id} style={styles.listCard} onPress={() => { setFloor(item); setRoom(null); setLevel('rooms'); }}>
            <View style={styles.listIcon}><Icon name="layers" size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.listTitle}>Floor {item.floorNumber}</Text><Text style={styles.muted}>{item.floorName || `${item.rooms?.length || 0} rooms`}</Text></View><IconAction icon="pencil-outline" color={colors.primary} onPress={() => openFloorForm(item)} /><IconAction icon="delete-outline" color={colors.danger} onPress={() => confirmDelete('Delete floor?', 'All rooms and beds on this floor will be deleted.', () => buildingApi.deleteFloor(building._id, item._id))} /><Icon name="chevron-right" size={21} color={colors.muted} />
          </Pressable>) : <EmptyState title="No floors available" message="Add a floor to continue." icon="layers-plus" />}</ScrollView>
        </> : null}

        {level === 'rooms' ? <>
          <View style={styles.sheetAction}><AppButton title="Add Room" icon="plus" onPress={() => openRoomForm(null)} /></View>
          <ScrollView contentContainerStyle={styles.sheetList}>{(floor?.rooms || []).length ? floor.rooms.map(item => { const occupied = item.beds?.filter(b => b.status === 'Occupied').length || 0; return <Pressable key={item._id} style={styles.listCard} onPress={() => { setRoom(item); setLevel('beds'); }}>
            <View style={styles.listIcon}><Icon name="door" size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.listTitle}>Room {item.roomNumber}</Text><Text style={styles.muted}>{item.shareType}-share · {occupied}/{item.beds?.length || 0} occupied</Text></View><IconAction icon="pencil-outline" color={colors.primary} onPress={() => openRoomForm(item)} /><IconAction icon="delete-outline" color={colors.danger} onPress={() => confirmDelete('Delete room?', 'All beds in this room will be deleted.', () => buildingApi.deleteRoom(building._id, floor._id, item._id))} /><Icon name="chevron-right" size={21} color={colors.muted} />
          </Pressable>; }) : <EmptyState title="No rooms available" message="Add a room to continue." icon="door-open" />}</ScrollView>
        </> : null}

        {level === 'beds' ? <>
          <View style={styles.sheetAction}><AppButton title="Add Bed" icon="bed-outline" onPress={addBed} /></View>
          <ScrollView contentContainerStyle={styles.bedGrid}>{(room?.beds || []).map(bed => { const occupied = bed.status === 'Occupied'; return <Pressable key={bed._id} style={[styles.bed, occupied ? styles.bedOccupied : styles.bedFree]} onPress={() => openBed(bed)}>
            <Icon name="bed" size={27} color={occupied ? colors.danger : colors.success} /><Text style={styles.bedTitle}>Bed {bed.bedNumber}</Text><Text style={[styles.bedStatus, { color: occupied ? colors.danger : colors.success }]}>{occupied ? 'Occupied' : 'Available'}</Text>{!occupied ? <Pressable style={styles.removeBed} onPress={() => removeBed(bed)}><Icon name="minus" size={16} color={colors.danger} /></Pressable> : <Text style={styles.tapInfo}>Tap for tenant</Text>}
          </Pressable>; })}</ScrollView>
        </> : null}
      </Sheet>

      <Sheet visible={!!formType} title={`${editing ? 'Edit' : 'Add'} ${formType || ''}`} subtitle={formType === 'floor' ? building?.buildingName : formType === 'room' ? `Floor ${floor?.floorNumber}` : 'Property details'} icon={editing ? 'pencil-outline' : 'plus'} onClose={() => { setFormType(null); setEditing(null); }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {formType === 'building' ? <><AppInput label="Building Name" value={bForm.buildingName} onChangeText={value => setBForm(prev => ({ ...prev, buildingName: value }))} /><AppInput label="Address" value={bForm.address} onChangeText={value => setBForm(prev => ({ ...prev, address: value }))} /></> : null}
          {formType === 'floor' ? <><AppInput label="Floor Number" value={fForm.floorNumber} keyboardType="numeric" onChangeText={value => setFForm(prev => ({ ...prev, floorNumber: value }))} /><AppInput label="Floor Name" value={fForm.floorName} onChangeText={value => setFForm(prev => ({ ...prev, floorName: value }))} /></> : null}
          {formType === 'room' ? <><AppInput label="Room Number" value={rForm.roomNumber} onChangeText={value => setRForm(prev => ({ ...prev, roomNumber: value }))} /><Text style={styles.fieldLabel}>Share Type</Text><View style={styles.shareRow}>{SHARE_OPTIONS.map(value => <Pressable key={value} style={[styles.share, Number(rForm.shareType) === value && styles.shareActive]} onPress={() => setRForm(prev => ({ ...prev, shareType: String(value) }))}><Icon name="bed-outline" size={17} color={Number(rForm.shareType) === value ? '#fff' : colors.primary} /><Text style={[styles.shareText, Number(rForm.shareType) === value && styles.shareTextActive]}>{value}</Text></Pressable>)}</View><Text style={styles.muted}>{rForm.shareType} beds will be created for this room.</Text></> : null}
          <AppButton title={editing ? 'Save Changes' : `Add ${formType || ''}`} icon="check" loading={saving} onPress={save} />
        </ScrollView>
      </Sheet>

      <Sheet visible={!!tenant} title="Tenant Details" subtitle={tenant?.name} icon="account-outline" tall onClose={() => setTenant(null)}>
        <ScrollView contentContainerStyle={styles.form}><View style={styles.tenantHero}><View style={styles.avatar}><Text style={styles.avatarText}>{tenant?.name?.[0]?.toUpperCase()}</Text></View><View><Text style={styles.tenantName}>{tenant?.name}</Text><Text style={styles.muted}>{tenant?.phone}</Text></View></View>
          {[['Email', tenant?.email], ["Father's Name", tenant?.fatherName], ['Joining Date', dateText(tenant?.joiningDate)], ['Monthly Rent', money(tenant?.rentAmount || 0)], ['Address', tenant?.permanentAddress]].filter(([, v]) => v).map(([label, value]) => <View style={styles.infoRow} key={label}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>)}
          <View style={styles.contactRow}><AppButton title="Call" icon="phone" style={styles.contact} onPress={() => Linking.openURL(`tel:${tenant?.phone}`)} /><AppButton title="WhatsApp" icon="whatsapp" style={styles.contact} onPress={() => Linking.openURL(`https://wa.me/91${tenant?.phone?.replace(/\D/g, '')}`)} /></View>
        </ScrollView>
      </Sheet>

      <Sheet visible={!!planInfo} title="Plan Limit Exceeded" subtitle="Bed limit reached for your current plan" icon="alert-circle-outline" onClose={() => setPlanInfo(null)}>
        <View style={styles.form}><View style={styles.limitBox}><Text style={styles.infoValue}>Plan bed limit: {planInfo?.bedLimit}</Text><Text style={styles.infoValue}>Beds used: {planInfo?.usedBeds}</Text><Text style={styles.infoValue}>Beds remaining: {planInfo?.remainingBeds}</Text></View><Text style={styles.limitText}>Please contact support to upgrade or extend your plan before adding more beds.</Text><AppButton title="Got it" icon="check" onPress={() => setPlanInfo(null)} /></View>
      </Sheet>
      <Pressable accessibilityLabel="New building" style={styles.fab} onPress={() => openBuildingForm(null)}><Icon name="plus" size={25} color="#fff" /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, body: { padding: 16, paddingBottom: 0 }, flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, muted: { color: colors.muted, fontSize: 12, marginTop: 2 }, footerSpace: { height: 110 },
  usage: { backgroundColor: colors.surface, borderRadius: 16, padding: 10, marginBottom: 10, shadowColor: '#111827', shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, usageFull: { backgroundColor: colors.dangerSoft }, usageTitle: { color: colors.text, fontWeight: '900', fontSize: 13 }, usagePct: { color: colors.primary, fontWeight: '900' }, limitPct: { color: colors.danger }, track: { height: 5, borderRadius: 6, backgroundColor: '#e5e7eb', overflow: 'hidden', marginTop: 8 }, fill: { height: '100%', borderRadius: 6 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, marginBottom: 10, shadowColor: '#111827', shadowOpacity: .06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, statItem: { flex: 1, alignItems: 'center' }, statValue: { fontSize: 18, fontWeight: '900', color: colors.primary }, statLabel: { fontSize: 9, color: colors.muted, fontWeight: '700', marginTop: 2 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 10 }, sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, heading: { fontSize: 20, fontWeight: '900', color: colors.text },
  propertyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 10, shadowColor: '#111827', shadowOpacity: .07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 }, propertyTop: { flexDirection: 'row', alignItems: 'center', gap: 9 }, buildingIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, buildingName: { fontSize: 16, fontWeight: '900', color: colors.text }, moreButton: { width: 34, height: 34, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.faint }, metadata: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 9 }, cardFoot: { marginTop: 7, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, viewDetails: { color: colors.primary, fontSize: 12, fontWeight: '900' }, overflowMenu: { position: 'absolute', right: 12, top: 48, width: 128, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 5, shadowColor: '#111827', shadowOpacity: .16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8, zIndex: 10 }, menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12 }, menuText: { fontSize: 12, color: colors.text, fontWeight: '800' }, deleteText: { color: colors.danger }, iconAction: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.55)' }, sheet: { maxHeight: '82%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }, tallSheet: { height: '88%' }, sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, sheetIcon: { width: 38, height: 38, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textTransform: 'capitalize' }, sheetSub: { color: colors.muted, fontSize: 11, marginTop: 2 }, close: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }, sheetAction: { paddingHorizontal: 16, paddingTop: 12 }, sheetList: { padding: 16 },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderRadius: 16, marginBottom: 7, backgroundColor: colors.surface }, listIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }, listTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
  bedGrid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, bed: { width: '47%', borderRadius: 16, padding: 13, alignItems: 'center' }, bedFree: { backgroundColor: colors.successSoft }, bedOccupied: { backgroundColor: colors.dangerSoft }, bedTitle: { color: colors.text, fontWeight: '900', marginTop: 5 }, bedStatus: { fontSize: 11, fontWeight: '800', marginTop: 2 }, removeBed: { position: 'absolute', right: 6, top: 6, width: 25, height: 25, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, tapInfo: { fontSize: 9, color: colors.muted, marginTop: 5 },
  form: { padding: 18, gap: 10 }, fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, shareRow: { flexDirection: 'row', gap: 7 }, share: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, shareActive: { backgroundColor: colors.primary, borderColor: colors.primary }, shareText: { color: colors.primary, fontWeight: '900', fontSize: 10 }, shareTextActive: { color: '#fff' }, tenantHero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 23, fontWeight: '900' }, tenantName: { color: colors.text, fontSize: 20, fontWeight: '900' }, infoRow: { padding: 12, borderRadius: 16, backgroundColor: colors.faint }, infoLabel: { fontSize: 10, color: colors.muted, fontWeight: '800', textTransform: 'uppercase' }, infoValue: { fontSize: 13, color: colors.text, fontWeight: '700', marginTop: 3 }, contactRow: { flexDirection: 'row', gap: 10 }, contact: { flex: 1 }, limitBox: { padding: 14, borderRadius: 16, backgroundColor: colors.dangerSoft, gap: 6 }, limitText: { color: colors.muted, lineHeight: 20, paddingVertical: 6 }, fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOpacity: .28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});

import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Alert, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import AppInput from '../../components/AppInput';
import EmptyState from '../../components/EmptyState';
import Loading from '../../components/Loading';
import { buildingApi } from '../../api/buildingApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage, money } from '../../utils/helpers';

const MODES = [
  ['browse', 'Browse', 'office-building-search-outline'],
  ['search', 'Search', 'magnify'],
  ['share', 'Share Type', 'bed-outline'],
];
const pct = (value, total) => (total ? Math.round((value / total) * 100) : 0);

const overviewCache = {
  hasData: false,
  stats: [],
  buildings: [],
};

function Choice({ label, selected, onPress }) {
  return (
    <Pressable style={[styles.choice, selected && styles.choiceActive]} onPress={onPress}>
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}
function Kpi({ icon, label, value, color }) {
  return (
    <View style={[styles.kpi, { backgroundColor: `${color}10`, borderColor: `${color}35` }]}>
      <Icon name={icon} size={20} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color }]}>{label}</Text>
    </View>
  );
}
function Info({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function RoomCard({ data, onTenant }) {
  const beds = data?.beds || [];
  const occupied = beds.filter(b => b.status === 'Occupied').length;
  const occupancy = pct(occupied, beds.length);
  const color = occupancy === 100 ? colors.danger : occupancy >= 60 ? colors.warning : colors.success;
  return (
    <View style={styles.roomCard}>
      <View style={styles.roomHead}>
        <View style={styles.flex}>
          <Text style={styles.roomTitle}>{data.buildingName} / Floor {data.floorNumber} / Room {data.roomNumber}</Text>
          <Text style={styles.muted}>{data.floorName || ''}</Text>
        </View>
        <Text style={styles.shareBadge}>{data.shareType}-share</Text>
      </View>
      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: `${occupancy}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.bedGrid}>
        {beds.map((bed, index) => {
          const occupiedBed = bed.status === 'Occupied';
          const tenant = bed.tenant || (typeof bed.tenantId === 'object' ? bed.tenantId : null);
          return (
            <Pressable
              key={bed._id || index}
              style={[styles.bed, occupiedBed ? styles.occupiedBed : styles.freeBed]}
              onPress={() => occupiedBed && onTenant(tenant || bed)}>
              <Icon name="bed" size={25} color={occupiedBed ? colors.danger : colors.success} />
              <Text style={styles.bedName}>Bed {bed.bedNumber}</Text>
              <Text style={[styles.bedStatus, { color: occupiedBed ? colors.danger : colors.success }]}>
                {occupiedBed ? (tenant?.name?.split(' ')[0] || 'Occupied') : 'Free'}
              </Text>
              {occupiedBed ? <Text style={styles.tap}>Tap for info</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TenantModal({ tenant, onClose }) {
  return (
    <Modal visible={!!tenant} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{tenant?.name?.[0]?.toUpperCase() || 'T'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.modalName}>{tenant?.name || 'Tenant'}</Text>
              <Text style={styles.modalPhone}>{tenant?.phone || ''}</Text>
            </View>
            <Pressable style={styles.heroClose} onPress={onClose}>
              <Icon name="close" size={20} color="#fff" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <Info label="Email" value={tenant?.email} />
            <Info label="Joining Date" value={dateText(tenant?.joiningDate)} />
            <Info label="Monthly Rent" value={tenant?.rentAmount ? money(tenant.rentAmount) : null} />
            <Info label="Address" value={tenant?.permanentAddress} />
            <Info
              label="Room"
              value={
                tenant?.allocationInfo?.buildingName
                  ? `${tenant.allocationInfo.buildingName} · Floor ${tenant.allocationInfo.floorNumber} · Room ${tenant.allocationInfo.roomNumber} · Bed ${tenant.allocationInfo.bedNumber}`
                  : null
              }
            />
            <View style={styles.contactRow}>
              <AppButton title="Call" icon="phone" style={styles.contact} onPress={() => Linking.openURL(`tel:${tenant?.phone}`)} />
              <AppButton
                title="WhatsApp"
                icon="whatsapp"
                style={styles.contact}
                onPress={() => Linking.openURL(`https://wa.me/91${tenant?.phone?.replace(/\D/g, '')}`)}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function OverviewDataSkeleton() {
  return (
    <View pointerEvents="none">
      <View style={styles.kpis}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.kpi, { backgroundColor: '#e4e8ef10', borderColor: '#e4e8ef35' }]}>
            <View style={[styles.skeletonBlock, { width: 20, height: 20, borderRadius: 10 }]} />
            <View style={[styles.skeletonBlock, { width: '60%', height: 16, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '40%', height: 10, marginTop: 4 }]} />
          </View>
        ))}
      </View>
      <View style={styles.skeletonCard}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={[styles.skeletonBlock, { flex: 1, height: 38, borderRadius: 10 }]} />
          <View style={[styles.skeletonBlock, { flex: 1, height: 38, borderRadius: 10 }]} />
          <View style={[styles.skeletonBlock, { flex: 1, height: 38, borderRadius: 10 }]} />
        </View>
        <View style={[styles.skeletonBlock, { width: '30%', height: 10, marginTop: 18 }]} />
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>
          <View style={[styles.skeletonBlock, { width: 80, height: 32, borderRadius: 9 }]} />
          <View style={[styles.skeletonBlock, { width: 90, height: 32, borderRadius: 9 }]} />
        </View>
      </View>
      {[0, 1].map(i => (
        <View key={i} style={styles.skeletonCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={[styles.skeletonBlock, { width: '50%', height: 16 }]} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[styles.skeletonBlock, { width: 34, height: 34, borderRadius: 9 }]} />
              <View style={[styles.skeletonBlock, { width: 34, height: 34, borderRadius: 9 }]} />
            </View>
          </View>
          <View style={[styles.skeletonBlock, { width: '40%', height: 12, marginTop: 6 }]} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
            {[0, 1, 2, 3, 4].map(j => (
              <View key={j} style={{ flex: 1, height: 42, backgroundColor: '#f3f4f6', borderRadius: 9, padding: 6, alignItems: 'center' }}>
                <View style={[styles.skeletonBlock, { width: '70%', height: 12 }]} />
                <View style={[styles.skeletonBlock, { width: '50%', height: 8, marginTop: 4 }]} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OverviewScreen({ navigation }) {
  const [dataLoading, setDataLoading] = useState(!overviewCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(overviewCache.stats);
  const [buildings, setBuildings] = useState(overviewCache.buildings);

  const [mode, setMode] = useState('browse');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [browseRoom, setBrowseRoom] = useState(null);
  const [share, setShare] = useState('');
  const [populated, setPopulated] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [tenant, setTenant] = useState(null);
  const [edit, setEdit] = useState(null);
  const [editForm, setEditForm] = useState({ buildingName: '', address: '' });

  const hasLoadedRef = useRef(overviewCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [overview, list] = await Promise.all([
        buildingApi.overview(),
        buildingApi.list(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      const safeOverview = Array.isArray(overview) ? overview : [];
      const safeList = Array.isArray(list) ? list : [];
      setStats(safeOverview);
      setBuildings(safeList);
      setPopulated([]);
      overviewCache.hasData = true;
      overviewCache.stats = safeOverview;
      overviewCache.buildings = safeList;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load({ background: hasLoadedRef.current || overviewCache.hasData })
        .then(() => { hasLoadedRef.current = true; });
    }, [load])
  );

  const totals = useMemo(
    () =>
      stats.reduce(
        (sum, item) => ({
          beds: sum.beds + Number(item.totalBeds || 0),
          occupied: sum.occupied + Number(item.occupiedBeds || 0),
          available: sum.available + Number(item.availableBeds || 0),
          tenants: sum.tenants + Number(item.totalTenants || 0),
          revenue: sum.revenue + Number(item.totalRevenue || 0),
        }),
        { beds: 0, occupied: 0, available: 0, tenants: 0, revenue: 0 }
      ),
    [stats]
  );

  const selectedBuilding = buildings.find(item => item._id === buildingId);
  const floors = selectedBuilding?.floors || [];
  const selectedFloor = floors.find(item => item._id === floorId);
  const rooms = selectedFloor?.rooms || [];

  const chooseBuilding = id => {
    setBuildingId(id);
    setFloorId('');
    setRoomId('');
    setBrowseRoom(null);
  };
  const chooseFloor = id => {
    setFloorId(id);
    setRoomId('');
    setBrowseRoom(null);
  };
  const chooseRoom = async id => {
    setRoomId(id);
    try {
      const full = await buildingApi.get(buildingId);
      const f = full.floors?.find(item => item._id === floorId);
      const room = f?.rooms?.find(item => item._id === id);
      setBrowseRoom(
        room
          ? {
              ...room,
              buildingName: full.buildingName,
              floorNumber: f.floorNumber,
              floorName: f.floorName,
            }
          : null
      );
    } catch (error) {
      Alert.alert('Room details', getMessage(error));
    }
  };
  const runSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const result = await buildingApi.searchRoom(search.trim());
      setSearchResults(Array.isArray(result) ? result : [result].filter(Boolean));
    } catch (error) {
      setSearchResults([]);
      Alert.alert('Room search', getMessage(error));
    } finally {
      setSearching(false);
    }
  };
  const loadShares = async () => {
    if (populated.length) return;
    setShareLoading(true);
    try {
      setPopulated((await Promise.all(buildings.map(item => buildingApi.get(item._id)))).filter(Boolean));
    } catch (error) {
      Alert.alert('Share explorer', getMessage(error));
    } finally {
      setShareLoading(false);
    }
  };
  const shareTypes = useMemo(() => {
    const values = new Set();
    buildings.forEach(b =>
      b.floors?.forEach(f =>
        f.rooms?.forEach(r => r.shareType && values.add(Number(r.shareType)))
      )
    );
    return [...values].sort((a, b) => a - b);
  }, [buildings]);

  const shareRooms = useMemo(() => {
    if (!share) return [];
    const list = [];
    populated.forEach(b =>
      b.floors?.forEach(f =>
        f.rooms?.forEach(r => {
          if (Number(r.shareType) === Number(share))
            list.push({
              ...r,
              buildingName: b.buildingName,
              floorNumber: f.floorNumber,
              floorName: f.floorName,
            });
        })
      )
    );
    return list;
  }, [populated, share]);

  const shareTotals = useMemo(() => {
    const beds = shareRooms.flatMap(r => r.beds || []);
    return {
      total: beds.length,
      occupied: beds.filter(b => b.status === 'Occupied').length,
      free: beds.filter(b => b.status !== 'Occupied').length,
    };
  }, [shareRooms]);

  const saveEdit = async () => {
    try {
      await buildingApi.update(edit._id, editForm);
      setEdit(null);
      load();
    } catch (error) {
      Alert.alert('Update failed', getMessage(error));
    }
  };
  const remove = id =>
    Alert.alert('Delete building?', 'All floors, rooms and beds will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await buildingApi.remove(id);
            load();
          } catch (error) {
            Alert.alert('Delete failed', getMessage(error));
          }
        },
      },
    ]);

  const setView = next => {
    setMode(next);
    if (next === 'share') loadShares();
  };

  const hasData = overviewCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  return (
    <View style={styles.screen}>
      <AppHeader title="Buildings Overview" subtitle="Live occupancy and room details" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {showSkeleton ? (
          <OverviewDataSkeleton />
        ) : showError ? (
          <EmptyState title="Unable to load overview" message={dataError} icon="wifi-alert" />
        ) : (
          <>
            <View style={styles.kpis}>
              <Kpi icon="bed-outline" label="Beds" value={totals.beds} color={colors.info} />
              <Kpi icon="account-check-outline" label="Occupied" value={totals.occupied} color={colors.danger} />
              <Kpi icon="bed-empty" label="Available" value={totals.available} color={colors.success} />
              <Kpi icon="account-group-outline" label="Tenants" value={totals.tenants} color={colors.violet} />
            </View>
            <AppCard>
              <View style={styles.modeTabs}>
                {MODES.map(([key, label, icon]) => (
                  <Pressable
                    key={key}
                    style={[styles.modeTab, mode === key && styles.modeActive]}
                    onPress={() => setView(key)}>
                    <Icon name={icon} size={19} color={mode === key ? '#fff' : colors.muted} />
                    <Text style={[styles.modeText, mode === key && styles.modeTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {mode === 'browse' ? (
                <View style={styles.viewer}>
                  <Text style={styles.fieldLabel}>Building</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                    {buildings.map(item => (
                      <Choice
                        key={item._id}
                        label={item.buildingName}
                        selected={buildingId === item._id}
                        onPress={() => chooseBuilding(item._id)}
                      />
                    ))}
                  </ScrollView>
                  {buildingId ? (
                    <>
                      <Text style={styles.fieldLabel}>Floor</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                        {floors.map(item => (
                          <Choice
                            key={item._id}
                            label={`Floor ${item.floorNumber}`}
                            selected={floorId === item._id}
                            onPress={() => chooseFloor(item._id)}
                          />
                        ))}
                      </ScrollView>
                    </>
                  ) : null}
                  {floorId ? (
                    <>
                      <Text style={styles.fieldLabel}>Room</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                        {rooms.map(item => (
                          <Choice
                            key={item._id}
                            label={`Room ${item.roomNumber}`}
                            selected={roomId === item._id}
                            onPress={() => chooseRoom(item._id)}
                          />
                        ))}
                      </ScrollView>
                    </>
                  ) : null}
                  {browseRoom ? <RoomCard data={browseRoom} onTenant={setTenant} /> : null}
                </View>
              ) : null}
              {mode === 'search' ? (
                <View style={styles.viewer}>
                  <AppInput label="Search Room Number" value={search} onChangeText={setSearch} />
                  <AppButton title="Search" icon="magnify" loading={searching} onPress={runSearch} />
                  {searchResults?.length === 0 ? (
                    <EmptyState title="No room found" icon="magnify-close" />
                  ) : (
                    searchResults?.map((item, index) => (
                      <RoomCard key={item._id || index} data={item} onTenant={setTenant} />
                    ))
                  )}
                </View>
              ) : null}
              {mode === 'share' ? (
                <View style={styles.viewer}>
                  <Text style={styles.fieldLabel}>Share Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                    {shareTypes.map(value => (
                      <Choice
                        key={value}
                        label={`${value}-Share`}
                        selected={Number(share) === value}
                        onPress={() => setShare(String(value))}
                      />
                    ))}
                  </ScrollView>
                  {shareLoading ? (
                    <Loading label="Loading rooms..." />
                  ) : share ? (
                    <>
                      <View style={styles.shareStats}>
                        <Kpi icon="bed-empty" label="Free" value={shareTotals.free} color={colors.success} />
                        <Kpi icon="account-check-outline" label="Occupied" value={shareTotals.occupied} color={colors.danger} />
                        <Kpi icon="bed-outline" label="Total" value={shareTotals.total} color={colors.info} />
                      </View>
                      {shareRooms.length ? (
                        shareRooms.map((item, index) => (
                          <RoomCard key={item._id || index} data={item} onTenant={setTenant} />
                        ))
                      ) : (
                        <EmptyState title={`No ${share}-share rooms`} icon="bed-outline" />
                      )}
                    </>
                  ) : (
                    <EmptyState title="Select a share type" message="See availability across all buildings." icon="bed-outline" />
                  )}
                </View>
              ) : null}
            </AppCard>
            <Text style={styles.sectionTitle}>Buildings Overview</Text>
            {stats.length ? (
              stats.map(item => {
                const occupancy = pct(item.occupiedBeds, item.totalBeds);
                const color = occupancy === 100 ? colors.danger : occupancy >= 60 ? colors.warning : colors.success;
                return (
                  <AppCard key={item.buildingId}>
                    <View style={styles.buildingHead}>
                      <View style={styles.flex}>
                        <Text style={styles.buildingName}>{item.buildingName}</Text>
                        <Text style={styles.muted}>{item.address || 'No address'}</Text>
                      </View>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => {
                          setEdit(item);
                          setEditForm({
                            buildingName: item.buildingName,
                            address: item.address || '',
                          });
                        }}>
                        <Icon name="pencil-outline" size={17} color={colors.info} />
                      </Pressable>
                      <Pressable style={styles.deleteButton} onPress={() => remove(item.buildingId)}>
                        <Icon name="delete-outline" size={17} color={colors.danger} />
                      </Pressable>
                    </View>
                    <View style={styles.buildStats}>
                      {[
                        ['Floors', item.totalFloors],
                        ['Rooms', item.totalRooms],
                        ['Beds', item.totalBeds],
                        ['Free', item.availableBeds],
                        ['Revenue', money(item.totalRevenue || 0)],
                      ].map(([label, value]) => (
                        <View style={styles.buildStat} key={label}>
                          <Text style={styles.buildValue}>{value}</Text>
                          <Text style={styles.buildLabel}>{label}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.occupancyHead}>
                      <Text style={styles.muted}>Occupancy</Text>
                      <Text style={[styles.occupancy, { color }]}>{occupancy}%</Text>
                    </View>
                    <View style={styles.progress}>
                      <View style={[styles.progressFill, { width: `${occupancy}%`, backgroundColor: color }]} />
                    </View>
                  </AppCard>
                );
              })
            ) : (
              <EmptyState title="No buildings yet" icon="office-building-outline" />
            )}
          </>
        )}
        <View style={styles.footer} />
      </ScrollView>
      <TenantModal tenant={tenant} onClose={() => setTenant(null)} />
      <Modal visible={!!edit} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <View style={styles.backdrop}>
          <View style={styles.editModal}>
            <View style={styles.editHead}>
              <Text style={styles.modalTitle}>Edit Building</Text>
              <Pressable onPress={() => setEdit(null)}>
                <Icon name="close" size={21} color={colors.muted} />
              </Pressable>
            </View>
            <AppInput
              label="Building Name"
              value={editForm.buildingName}
              onChangeText={value => setEditForm(prev => ({ ...prev, buildingName: value }))}
            />
            <AppInput
              label="Address"
              value={editForm.address}
              onChangeText={value => setEditForm(prev => ({ ...prev, address: value }))}
            />
            <AppButton title="Save Changes" icon="check" onPress={saveEdit} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16 },
  flex: { flex: 1 },
  muted: { fontSize: 11, color: colors.muted, marginTop: 2 },
  footer: { height: 80 },
  kpis: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 9, alignItems: 'center' },
  kpiValue: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  kpiLabel: { fontSize: 9, fontWeight: '800' },
  modeTabs: { flexDirection: 'row', gap: 6 },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.faint,
  },
  modeActive: { backgroundColor: colors.primary },
  modeText: { fontSize: 10, color: colors.muted, fontWeight: '800' },
  modeTextActive: { color: '#fff' },
  viewer: { marginTop: 14 },
  fieldLabel: {
    fontSize: 10,
    color: colors.muted,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 7,
  },
  choices: { gap: 7, paddingBottom: 6 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 11, color: colors.text, fontWeight: '800' },
  choiceTextActive: { color: '#fff' },
  roomCard: { backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, marginTop: 12 },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomTitle: { fontSize: 12, color: colors.text, fontWeight: '900' },
  shareBadge: {
    fontSize: 10,
    color: colors.info,
    fontWeight: '900',
    backgroundColor: colors.infoSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progress: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 6 },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  bed: { width: '31%', borderWidth: 1.5, borderRadius: 11, paddingVertical: 9, alignItems: 'center' },
  occupiedBed: { backgroundColor: colors.dangerSoft, borderColor: '#fca5a5' },
  freeBed: { backgroundColor: colors.successSoft, borderColor: '#86efac' },
  bedName: { fontSize: 10, color: colors.text, fontWeight: '800' },
  bedStatus: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  tap: { fontSize: 8, color: colors.muted, marginTop: 2 },
  shareStats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  sectionTitle: { fontSize: 18, color: colors.text, fontWeight: '900', textAlign: 'center', marginVertical: 10 },
  buildingHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  buildingName: { fontSize: 16, color: colors.text, fontWeight: '900' },
  editButton: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  buildStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  buildStat: { minWidth: '18%', flex: 1, backgroundColor: colors.faint, borderRadius: 9, padding: 8, alignItems: 'center' },
  buildValue: { fontSize: 12, color: colors.primary, fontWeight: '900' },
  buildLabel: { fontSize: 8, color: colors.muted, fontWeight: '800', textTransform: 'uppercase' },
  occupancyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  occupancy: { fontSize: 11, fontWeight: '900' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,.55)' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%', overflow: 'hidden' },
  modalHero: { backgroundColor: colors.primary, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, color: '#fff', fontWeight: '900' },
  modalName: { fontSize: 17, color: '#fff', fontWeight: '900' },
  modalPhone: { fontSize: 12, color: '#c7d2fe', marginTop: 2 },
  heroClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 17, gap: 8 },
  info: { padding: 11, borderRadius: 10, backgroundColor: colors.faint },
  infoLabel: { fontSize: 9, color: colors.muted, fontWeight: '900', textTransform: 'uppercase' },
  infoValue: { fontSize: 12, color: colors.text, fontWeight: '700', marginTop: 3 },
  contactRow: { flexDirection: 'row', gap: 9, marginTop: 5 },
  contact: { flex: 1 },
  editModal: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  editHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, color: colors.text, fontWeight: '900' },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
  skeletonCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 12 },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppHeader from '../../components/AppHeader';
import EmptyState from '../../components/EmptyState';
import ProfileImagePopup from '../../components/ProfileImagePopup';
import { buildingApi } from '../../api/buildingApi';
import { rentApi } from '../../api/rentApi';
import { tenantApi } from '../../api/tenantApi';
import { colors } from '../../utils/constants';
import { compactLocation, getMessage, money } from '../../utils/helpers';

const RECENT_KEY = 'owner-search-recent-v1';
const pct = (value, total) => (total ? Math.round((value / total) * 100) : 0);

const searchCache = {
  hasData: false,
  tenants: [],
  rentMap: new Map(),
  rooms: [],
};

function Choice({ label, selected, onPress, icon }) {
  return (
    <Pressable style={[styles.choice, selected && styles.choiceActive]} onPress={onPress}>
      {icon ? <Icon name={icon} size={15} color={selected ? '#fff' : colors.primary} /> : null}
      <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Segment({ label, active, onPress }) {
  return (
    <Pressable style={[styles.segment, active && styles.segmentActive]} onPress={onPress} hitSlop={4}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Kpi({ icon, label, value, color }) {
  return (
    <View style={[styles.kpi, { backgroundColor: `${color}10`, borderColor: `${color}35` }]}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={[styles.kpiLabel, { color }]}>{label}</Text>
    </View>
  );
}

function RoomCard({ data, onTenant }) {
  const beds = data?.beds || [];
  const occupied = beds.filter(bed => bed.status === 'Occupied').length;
  const occupancy = pct(occupied, beds.length);
  const color = occupancy === 100 ? colors.danger : occupancy >= 60 ? colors.warning : colors.success;

  return (
    <View style={styles.roomCard}>
      <View style={styles.roomHead}>
        <View style={styles.flex}>
          <Text style={styles.roomTitle} numberOfLines={1}>
            {data.buildingName} / Floor {data.floorNumber} / Room {data.roomNumber}
          </Text>
          <Text style={styles.muted}>{occupied}/{beds.length || Number(data.shareType || 0)} occupied</Text>
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
              onPress={() => occupiedBed && onTenant(tenant)}>
              <Icon name="bed" size={24} color={occupiedBed ? colors.danger : colors.success} />
              <Text style={styles.bedName}>Bed {bed.bedNumber}</Text>
              <Text style={[styles.bedStatus, { color: occupiedBed ? colors.danger : colors.success }]} numberOfLines={1}>
                {occupiedBed ? (tenant?.name?.split(' ')[0] || 'Occupied') : 'Free'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CandidateCard({ tenant, rent, onPress, onPhotoPress }) {
  const due = Number(rent?.totalAccumulatedDue || rent?.currentRecord?.pendingAmount || 0);
  const overdue = rent?.hasPreviousPending;
  const photo = tenant?.documents?.passportPhoto;

  return (
    <Pressable style={[styles.candidateCard, overdue && styles.candidateDanger]} onPress={onPress}>
      <Pressable
        style={styles.avatar}
        disabled={!photo}
        onPress={event => {
          event.stopPropagation();
          if (photo) onPhotoPress({ imageUrl: photo, name: tenant.name });
        }}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{tenant.name?.[0]?.toUpperCase() || 'T'}</Text>
        )}
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.nameLine}>
          <Text style={styles.candidateName} numberOfLines={1}>{tenant.name}</Text>
          <Text style={[styles.status, tenant.status === 'Inactive' && styles.statusMuted]}>
            {tenant.status === 'Inactive' ? 'Vacated' : 'Active'}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{tenant.phone || 'No phone'}{tenant.email ? ` · ${tenant.email}` : ''}</Text>
        <Text style={styles.meta} numberOfLines={1}>{compactLocation(tenant)}</Text>
        <View style={styles.financeRow}>
          <View style={styles.financeBox}>
            <Text style={styles.financeLabel}>Rent</Text>
            <Text style={styles.financeValue}>{money(tenant.rentAmount || 0)}</Text>
          </View>
          <View style={styles.financeBox}>
            <Text style={styles.financeLabel}>Due</Text>
            <Text style={[styles.financeValue, due > 0 && styles.dueText]}>{money(due)}</Text>
          </View>
        </View>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );
}

function SearchCandidateSkeleton() {
  return (
    <View pointerEvents="none">
      {[0, 1].map(i => (
        <View key={i} style={styles.candidateCard}>
          <View style={[styles.skeletonBlock, { width: 48, height: 48, borderRadius: 24 }]} />
          <View style={styles.flex}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <View style={[styles.skeletonBlock, { width: '50%', height: 14 }]} />
              <View style={[styles.skeletonBlock, { width: 40, height: 12, borderRadius: 8 }]} />
            </View>
            <View style={[styles.skeletonBlock, { width: '40%', height: 10, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '45%', height: 10, marginTop: 6 }]} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={[styles.skeletonBlock, { flex: 1, height: 32, borderRadius: 8 }]} />
              <View style={[styles.skeletonBlock, { flex: 1, height: 32, borderRadius: 8 }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchRoomSkeleton() {
  return (
    <View pointerEvents="none">
      {[0, 1].map(i => (
        <View key={i} style={styles.roomCard}>
          <View style={styles.roomHead}>
            <View style={styles.flex}>
              <View style={[styles.skeletonBlock, { width: '60%', height: 12 }]} />
              <View style={[styles.skeletonBlock, { width: '40%', height: 10, marginTop: 4 }]} />
            </View>
            <View style={[styles.skeletonBlock, { width: 56, height: 18, borderRadius: 8 }]} />
          </View>
          <View style={[styles.skeletonBlock, { width: '100%', height: 6, borderRadius: 6, marginTop: 10 }]} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
            {[0, 1].map(j => (
              <View key={j} style={{ width: '31%', height: 62, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 6, alignItems: 'center' }}>
                <View style={[styles.skeletonBlock, { width: '60%', height: 10 }]} />
                <View style={[styles.skeletonBlock, { width: '50%', height: 8, marginTop: 4 }]} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function OwnerSearchScreen({ navigation }) {
  const [dataLoading, setDataLoading] = useState(!searchCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('name');
  const [rooms, setRooms] = useState(searchCache.rooms);
  const [tenants, setTenants] = useState(searchCache.tenants);
  const [rentMap, setRentMap] = useState(searchCache.rentMap);
  const [recent, setRecent] = useState([]);
  const [share, setShare] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [profilePopup, setProfilePopup] = useState(null);

  const hasLoadedRef = useRef(searchCache.hasData);
  const loadRequestRef = useRef(0);

  const flattenRooms = useCallback(list => {
    const output = [];
    list.forEach(building => {
      building.floors?.forEach(floor => {
        floor.rooms?.forEach(room => {
          output.push({
            ...room,
            buildingId: building._id,
            buildingName: building.buildingName,
            floorId: floor._id,
            floorNumber: floor.floorNumber,
            floorName: floor.floorName,
          });
        });
      });
    });
    return output;
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const saved = JSON.parse(await AsyncStorage.getItem(RECENT_KEY));
      setRecent(Array.isArray(saved) ? saved.slice(0, 5) : []);
    } catch {
      setRecent([]);
    }
  }, []);

  const saveRecent = useCallback(async item => {
    if (!item?.text?.trim()) return;
    setRecent(current => {
      const next = [item, ...current.filter(old => old.text !== item.text || old.mode !== item.mode)].slice(0, 5);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeRecent = item => {
    setRecent(current => {
      const next = current.filter(old => old.text !== item.text || old.mode !== item.mode);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

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
      const basicBuildings = Array.isArray(buildingList) ? buildingList : [];
      const safeTenants = Array.isArray(tenantList) ? tenantList : [];
      const safeRentMap = new Map((Array.isArray(rentList) ? rentList : []).map(item => [String(item.tenant?._id || item.tenantId), item]));

      setTenants(safeTenants);
      setRentMap(safeRentMap);

      const fullBuildings = (await Promise.all(basicBuildings.map(item => buildingApi.get(item._id).catch(() => item)))).filter(Boolean);
      const safeRooms = flattenRooms(fullBuildings);
      setRooms(safeRooms);

      searchCache.hasData = true;
      searchCache.tenants = safeTenants;
      searchCache.rentMap = safeRentMap;
      searchCache.rooms = safeRooms;
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        setDataError(getMessage(error));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
      }
    }
  }, [flattenRooms]);

  useFocusEffect(
    useCallback(() => {
      load({ background: hasLoadedRef.current || searchCache.hasData })
        .then(() => { hasLoadedRef.current = true; });
      loadRecent();
    }, [load, loadRecent])
  );

  useEffect(() => {
    setBuildingId('');
  }, [share, mode, query]);

  const normalized = query.trim().toLowerCase();
  const searching = normalized.length > 0;

  useEffect(() => {
    if (!normalized) return;
    const timer = setTimeout(() => saveRecent({ mode, text: query.trim() }), 700);
    return () => clearTimeout(timer);
  }, [mode, normalized, query, saveRecent]);

  const candidateResults = useMemo(() => {
    if (!searching || mode !== 'name') return [];
    return tenants.filter(item => item.name?.toLowerCase().includes(normalized));
  }, [mode, normalized, searching, tenants]);

  const allRoomResults = useMemo(() => {
    if (!searching || mode !== 'room') return [];
    return rooms.filter(item => String(item.roomNumber || '').toLowerCase().includes(normalized));
  }, [mode, normalized, rooms, searching]);

  const roomResults = useMemo(
    () => (buildingId ? allRoomResults.filter(item => item.buildingId === buildingId) : allRoomResults),
    [allRoomResults, buildingId]
  );

  const roomBuildings = useMemo(() => {
    const map = new Map();
    allRoomResults.forEach(item => map.set(item.buildingId, item.buildingName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [allRoomResults]);

  const shareTypes = useMemo(() => {
    const values = new Set();
    rooms.forEach(room => room.shareType && values.add(Number(room.shareType)));
    return [...values].sort((a, b) => a - b);
  }, [rooms]);

  const shareRooms = useMemo(() => {
    if (!share || searching) return [];
    const found = rooms.filter(item => Number(item.shareType) === Number(share));
    return buildingId ? found.filter(item => item.buildingId === buildingId) : found;
  }, [buildingId, rooms, searching, share]);

  const shareBuildings = useMemo(() => {
    const map = new Map();
    rooms.filter(item => Number(item.shareType) === Number(share)).forEach(item => map.set(item.buildingId, item.buildingName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rooms, share]);

  const shareTotals = useMemo(() => {
    const beds = shareRooms.flatMap(room => room.beds || []);
    return {
      total: beds.length,
      occupied: beds.filter(bed => bed.status === 'Occupied').length,
      free: beds.filter(bed => bed.status !== 'Occupied').length,
    };
  }, [shareRooms]);

  const openTenant = tenant => {
    const id = tenant?._id || tenant?.tenantId;
    if (id) navigation.navigate('TenantDetails', { tenantId: id });
  };

  const hasData = searchCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  return (
    <View style={styles.screen}>
      <AppHeader title="Search" subtitle="Find candidates, rooms and share types" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.searchPanel}>
          <View style={styles.segmentTrack}>
            <Segment
              label="By name"
              active={mode === 'name'}
              onPress={() => {
                setMode('name');
                setQuery('');
              }}
            />
            <Segment
              label="By room"
              active={mode === 'room'}
              onPress={() => {
                setMode('room');
                setQuery('');
              }}
            />
          </View>
          <View style={styles.searchBox}>
            <Icon name="magnify" size={21} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={mode === 'name' ? 'Search candidate name' : 'Search room number'}
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              keyboardType={mode === 'room' ? 'numbers-and-punctuation' : 'default'}
              returnKeyType="search"
              onSubmitEditing={() => saveRecent({ mode, text: query.trim() })}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')}>
                <Icon name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {showError ? (
          <EmptyState title="Unable to load search data" message={dataError} icon="wifi-alert" style={{ marginTop: 16 }} />
        ) : (
          <>
            {!searching && recent.length ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Recent searches</Text>
                <View style={styles.recentList}>
                  {recent.map(item => (
                    <Pressable
                      key={`${item.mode}-${item.text}`}
                      style={styles.recentChip}
                      onPress={() => {
                        setMode(item.mode);
                        setQuery(item.text);
                      }}>
                      <Icon name={item.mode === 'room' ? 'door-open' : 'account-search-outline'} size={15} color={colors.primary} />
                      <Text style={styles.recentText}>{item.text}</Text>
                      <Pressable onPress={() => removeRecent(item)} hitSlop={8}>
                        <Icon name="close" size={15} color={colors.muted} />
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {searching && mode === 'name' ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Candidates</Text>
                {showSkeleton ? (
                  <SearchCandidateSkeleton />
                ) : candidateResults.length ? (
                  candidateResults.map(item => (
                    <CandidateCard
                      key={item._id}
                      tenant={item}
                      rent={rentMap.get(String(item._id))}
                      onPress={() => openTenant(item)}
                      onPhotoPress={setProfilePopup}
                    />
                  ))
                ) : (
                  <EmptyState title="No candidate found" message="Try another name or check the spelling." icon="account-search-outline" />
                )}
              </View>
            ) : null}

            {searching && mode === 'room' ? (
              <View style={styles.block}>
                {roomBuildings.length > 1 ? (
                  <>
                    <Text style={styles.blockTitle}>Building filter</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                      <Choice label="All buildings" selected={!buildingId} onPress={() => setBuildingId('')} />
                      {roomBuildings.map(item => (
                        <Choice
                          key={item.id}
                          label={item.name}
                          selected={buildingId === item.id}
                          onPress={() => setBuildingId(item.id)}
                        />
                      ))}
                    </ScrollView>
                  </>
                ) : null}
                <Text style={styles.blockTitle}>Rooms</Text>
                {showSkeleton ? (
                  <SearchRoomSkeleton />
                ) : roomResults.length ? (
                  roomResults.map(item => (
                    <RoomCard key={`${item.buildingId}-${item.floorId}-${item._id}`} data={item} onTenant={openTenant} />
                  ))
                ) : (
                  <EmptyState title="No room found" message="This room number is not available in your buildings." icon="door-closed-lock" />
                )}
              </View>
            ) : null}

            {!searching ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Share types</Text>
                {showSkeleton ? (
                  <View style={{ height: 40, flexDirection: 'row', gap: 7 }}>
                    {[0, 1].map(i => (
                      <View key={i} style={[styles.skeletonBlock, { width: 70, height: 38, borderRadius: 8 }]} />
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                    {shareTypes.map(value => (
                      <Choice
                        key={value}
                        label={`${value}-Share`}
                        icon="bed-outline"
                        selected={Number(share) === value}
                        onPress={() => setShare(String(value))}
                      />
                    ))}
                  </ScrollView>
                )}
                {!showSkeleton && share ? (
                  <>
                    <Text style={styles.blockTitle}>Building filter</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
                      <Choice label="All buildings" selected={!buildingId} onPress={() => setBuildingId('')} />
                      {shareBuildings.map(item => (
                        <Choice
                          key={item.id}
                          label={item.name}
                          selected={buildingId === item.id}
                          onPress={() => setBuildingId(item.id)}
                        />
                      ))}
                    </ScrollView>
                    <View style={styles.shareStats}>
                      <Kpi icon="bed-empty" label="Free" value={shareTotals.free} color={colors.success} />
                      <Kpi icon="account-check-outline" label="Occupied" value={shareTotals.occupied} color={colors.danger} />
                      <Kpi icon="bed-outline" label="Total" value={shareTotals.total} color={colors.info} />
                    </View>
                    {shareRooms.length ? (
                      shareRooms.map(item => (
                        <RoomCard key={`${item.buildingId}-${item.floorId}-${item._id}`} data={item} onTenant={openTenant} />
                      ))
                    ) : (
                      <EmptyState title={`No ${share}-share rooms`} icon="bed-outline" />
                    )}
                  </>
                ) : !showSkeleton ? (
                  <EmptyState
                    title="Select a share type"
                    message="Rooms will be fetched across all buildings, with a building filter ready after selection."
                    icon="bed-outline"
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}
        <View style={styles.footer} />
      </ScrollView>
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
  body: { padding: 16 },
  flex: { flex: 1 },
  muted: { fontSize: 11, color: colors.muted, marginTop: 2 },
  footer: { height: 70 },
  searchPanel: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 },
  segmentTrack: { flexDirection: 'row', backgroundColor: colors.faint, borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 11.5, color: colors.muted, fontWeight: '700' },
  segmentTextActive: { color: colors.primary },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.faint, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  block: { marginTop: 16 },
  blockTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 8, textTransform: 'uppercase' },
  choices: { gap: 7, paddingBottom: 6 },
  choice: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 11, color: colors.text, fontWeight: '800' },
  choiceTextActive: { color: '#fff' },
  recentList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8 },
  recentText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  candidateCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  candidateDanger: { borderColor: '#fecaca', backgroundColor: '#fffafa' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 24 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  candidateName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '900' },
  status: { color: colors.success, backgroundColor: colors.successSoft, fontSize: 9, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  statusMuted: { color: colors.muted, backgroundColor: colors.faint },
  meta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  financeRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  financeBox: { flex: 1, backgroundColor: colors.faint, borderRadius: 8, padding: 8 },
  financeLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  financeValue: { color: colors.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  dueText: { color: colors.danger },
  roomCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 13, marginBottom: 11 },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomTitle: { fontSize: 12, color: colors.text, fontWeight: '900' },
  shareBadge: { fontSize: 10, color: colors.info, fontWeight: '900', backgroundColor: colors.infoSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  progress: { height: 6, backgroundColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', borderRadius: 6 },
  bedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  bed: { width: '31%', borderWidth: 1.5, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  occupiedBed: { backgroundColor: colors.dangerSoft, borderColor: '#fca5a5' },
  freeBed: { backgroundColor: colors.successSoft, borderColor: '#86efac' },
  bedName: { fontSize: 10, color: colors.text, fontWeight: '800' },
  bedStatus: { fontSize: 9, fontWeight: '800', marginTop: 2, maxWidth: '90%' },
  shareStats: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 9, alignItems: 'center' },
  kpiValue: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  kpiLabel: { fontSize: 9, fontWeight: '800' },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});

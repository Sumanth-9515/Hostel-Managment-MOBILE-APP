import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { activityApi } from '../../api/activityApi';
import { tenantApi } from '../../api/tenantApi';
import { dateText, getMessage, pickArray } from '../../utils/helpers';

const filters = ['All', 'Building', 'Floor', 'Room', 'Tenant', 'Rent'];

const activityCache = {
  hasData: false,
  logs: [],
};

// ── Light / Dark palettes (self-contained — screen adapts to the OS theme) ──
const palettes = {
  light: {
    bg: '#f5f6fb',
    surface: '#ffffff',
    headerBg: '#ffffff',
    text: '#0f172a',
    subtext: '#475569',
    muted: '#94a3b8',
    border: '#e8eaf1',
    chipBg: '#eef1f7',
    chipText: '#475569',
    iconBtn: '#f1f3f9',
    searchBg: '#f1f3f9',
    shadow: '#1e293b',
    shadowOpacity: 0.08,
  },
  dark: {
    bg: '#0a0e1a',
    surface: '#141a2a',
    headerBg: '#0f1422',
    text: '#f1f5f9',
    subtext: '#cbd5e1',
    muted: '#64748b',
    border: '#1f2738',
    chipBg: '#1b2335',
    chipText: '#cbd5e1',
    iconBtn: '#1b2335',
    searchBg: '#1b2335',
    shadow: '#000000',
    shadowOpacity: 0.4,
  },
};

// Category colour coding (consistent across light & dark).
const categoryMeta = {
  rent: { label: 'Rent', color: '#059669', soft: '#ecfdf5', icon: 'cash-multiple' },
  tenant: { label: 'Tenant', color: '#2563eb', soft: '#eff6ff', icon: 'account' },
  building: { label: 'Building', color: '#7c3aed', soft: '#f5f3ff', icon: 'office-building' },
  room: { label: 'Room', color: '#ea580c', soft: '#fff7ed', icon: 'door' },
  floor: { label: 'Floor', color: '#4338ca', soft: '#eef2ff', icon: 'layers-triple' },
  default: { label: 'Activity', color: '#64748b', soft: '#f1f5f9', icon: 'history' },
};

const metaFor = entityType => categoryMeta[String(entityType || '').toLowerCase()] || categoryMeta.default;

// Best-effort name of the entity this log refers to (used to pre-fill the
// destination screen's search box, e.g. the tenant's name for a rent payment).
const searchTermFor = item =>
  item?.entityName || item?.tenantName || item?.tenant?.name || item?.name ||
  item?.metadata?.name || item?.metadata?.tenantName || item?.metadata?.entityName ||
  item?.meta?.name || item?.details?.name || item?.entity?.name || '';

const idValue = value => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value._id || value.id || '';
  return String(value);
};

const tenantIdFor = item => {
  const type = String(item?.entityType || '').toLowerCase();
  return idValue(item?.tenantId) ||
    idValue(item?.tenant?._id || item?.tenant) ||
    idValue(item?.metadata?.tenantId || item?.metadata?.tenant) ||
    idValue(item?.meta?.tenantId || item?.meta?.tenant) ||
    idValue(item?.details?.tenantId || item?.details?.tenant) ||
    idValue(item?.entity?.tenantId || item?.entity?.tenant) ||
    (type === 'tenant' ? idValue(item?.entityId || item?.targetId || item?.referenceId) : '');
};

const activityHaystack = item => [
  item?.action,
  item?.type,
  item?.entityType,
  item?.description,
  item?.message,
  item?.entityName,
  item?.tenantName,
  item?.tenant?.name,
  item?.metadata?.name,
  item?.metadata?.tenantName,
  item?.metadata?.entityName,
  item?.meta?.name,
  item?.details?.name,
  item?.entity?.name,
].filter(Boolean).join(' ').toLowerCase();

// Translucent soft background that also reads well in dark mode.
const softTone = (meta, dark) => (dark ? `${meta.color}26` : meta.soft);

const cleanActivityText = value => {
  if (!value) return value;
  return String(value)
    .replace(/â‚¹|â‚|₹/g, '\u20B9')
    .replace(/\u20B9\s*,\s*/g, '\u20B9 ')
    .replace(/\u20B9\s+/g, '\u20B9 ');
};

const startOfDay = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const relativeTime = value => {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return dateText(value);
};

// Bucket logs into Today / Yesterday / This Week / Earlier.
const groupLogs = logs => {
  const today = startOfDay(Date.now());
  const yesterday = today - 86400000;
  const weekAgo = today - 6 * 86400000;
  const buckets = { Today: [], Yesterday: [], 'This Week': [], Earlier: [] };
  logs.forEach(item => {
    const ts = item?.createdAt ? startOfDay(item.createdAt) : 0;
    if (ts >= today) buckets.Today.push(item);
    else if (ts >= yesterday) buckets.Yesterday.push(item);
    else if (ts >= weekAgo) buckets['This Week'].push(item);
    else buckets.Earlier.push(item);
  });
  return ['Today', 'Yesterday', 'This Week', 'Earlier']
    .map(title => ({ title, data: buckets[title] }))
    .filter(section => section.data.length > 0);
};

function FilterChip({ label, active, theme, onPress }) {
  const meta = metaFor(label === 'All' ? 'default' : label);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: theme.chipBg },
        active && { backgroundColor: label === 'All' ? '#4338ca' : meta.color },
      ]}>
      {label !== 'All' ? (
        <Icon name={meta.icon} size={14} color={active ? '#fff' : meta.color} />
      ) : (
        <Icon name="view-grid-outline" size={14} color={active ? '#fff' : theme.chipText} />
      )}
      <Text style={[styles.chipText, { color: active ? '#fff' : theme.chipText }]}>{label}</Text>
    </Pressable>
  );
}

function LogCard({ item, index, theme, dark, onPress }) {
  const meta = metaFor(item.entityType);
  const title = item.action || item.type || 'Activity';
  const description = cleanActivityText(item.description || item.message);

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 8) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}>
      <Pressable
        onPress={() => onPress?.(item)}
        android_ripple={{ color: meta.soft }}
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            shadowColor: theme.shadow,
            shadowOpacity: theme.shadowOpacity,
            borderColor: theme.border,
          },
        ]}>
        <View style={[styles.cardIcon, { backgroundColor: softTone(meta, dark) }]}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.categoryLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
            <Text style={[styles.timeAgo, { color: theme.muted }]}>{relativeTime(item.createdAt)}</Text>
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          {description ? (
            <Text style={[styles.cardDesc, { color: theme.subtext }]} numberOfLines={2}>{description}</Text>
          ) : null}
          <Text style={[styles.cardDate, { color: theme.muted }]}>{dateText(item.createdAt)}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.muted} style={styles.chevron} />
      </Pressable>
    </Animated.View>
  );
}

function ActivityDataSkeleton({ theme }) {
  return (
    <View pointerEvents="none" style={styles.listContent}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowOpacity: 0,
            },
          ]}>
          <View style={[styles.cardIcon, { backgroundColor: '#e4e8ef' }]} />
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={[styles.skeletonBlock, { width: 50, height: 10 }]} />
              <View style={[styles.skeletonBlock, { width: 40, height: 10 }]} />
            </View>
            <View style={[styles.skeletonBlock, { width: '70%', height: 14, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '90%', height: 11, marginTop: 6 }]} />
            <View style={[styles.skeletonBlock, { width: '30%', height: 10, marginTop: 6 }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ActivityLogsScreen({ navigation, onLogout }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const theme = dark ? palettes.dark : palettes.light;

  const [dataLoading, setDataLoading] = useState(!activityCache.hasData);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState(activityCache.logs);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const hasLoadedRef = useRef(activityCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setError(null);
    try {
      const data = await activityApi.list({ page: 1, limit: 50, entityType: filter });
      if (requestId !== loadRequestRef.current) return;
      const safeLogs = pickArray(data);
      setLogs(safeLogs);
      activityCache.hasData = true;
      activityCache.logs = safeLogs;
    } catch (err) {
      if (requestId === loadRequestRef.current) {
        setError(getMessage(err));
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setDataLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || activityCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Tap an activity → open the screen it belongs to, pre-filtered to that entity.
  // Building / Floor / Room → My Hostels. Tenant → Candidates. Rent → Rent Payments.
  const openActivity = useCallback(async item => {
    const directTenantId = tenantIdFor(item);
    if (directTenantId) {
      navigation.navigate('TenantDetails', { tenantId: directTenantId });
      return;
    }

    const term = searchTermFor(item).trim().toLowerCase();
    const haystack = activityHaystack(item);
    try {
      const tenants = await tenantApi.list();
      const list = Array.isArray(tenants) ? tenants : [];
      const match = list.find(tenant => {
        const name = String(tenant?.name || '').trim().toLowerCase();
        if (!name) return false;
        return (term && name === term) || (term && name.includes(term)) || haystack.includes(name);
      });
      if (match?._id) {
        navigation.navigate('TenantDetails', { tenantId: match._id });
      } else {
        Alert.alert('Candidate not found', 'This activity log does not have enough candidate details to open full tenant details.');
      }
    } catch (err) {
      Alert.alert('Unable to open candidate', getMessage(err));
    }
  }, [navigation]);

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? logs.filter(item => {
          const haystack = `${item.action || ''} ${item.type || ''} ${item.entityType || ''} ${item.description || ''} ${item.message || ''}`.toLowerCase();
          return haystack.includes(query);
        })
      : logs;
    return groupLogs(filtered);
  }, [logs, search]);

  const hasData = activityCache.hasData;
  const showSkeleton = dataLoading && !hasData;

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.headerBg }}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: theme.iconBtn }]}>
            <Icon name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Activity Logs</Text>
            <Text style={[styles.headerSubtitle, { color: theme.muted }]}>Recent hostel actions & changes</Text>
          </View>
          <View style={[styles.iconBtn, { backgroundColor: theme.iconBtn }]}>
            <Icon name="history" size={20} color="#4338ca" />
          </View>
        </View>
      </SafeAreaView>

      {/* ── Search bar ── */}
      <View style={styles.controls}>
        <View style={[styles.searchBar, { backgroundColor: theme.searchBg, borderColor: theme.border }]}>
          <Icon name="magnify" size={20} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search activities"
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {filters.map(item => (
            <FilterChip
              key={item}
              label={item}
              active={filter === item}
              theme={theme}
              onPress={() => setFilter(item)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Content ── */}
      {showSkeleton ? (
        <ActivityDataSkeleton theme={theme} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item._id || String(index)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4338ca" colors={['#4338ca']} />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.subtext }]}>{section.title}</Text>
              <View style={[styles.sectionCount, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.sectionCountText, { color: theme.subtext }]}>{section.data.length}</Text>
              </View>
            </View>
          )}
          renderItem={({ item, index }) => (
            <LogCard item={item} index={index} theme={theme} dark={dark} onPress={openActivity} />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.chipBg }]}>
                <Icon name={error ? 'wifi-off' : 'timeline-text-outline'} size={40} color={theme.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {error ? 'Could not load activity' : search ? 'No matches found' : 'No activity yet'}
              </Text>
              <Text style={[styles.emptyMessage, { color: theme.muted }]}>
                {error || (search
                  ? 'Try a different search term or filter.'
                  : 'Actions across your hostels will show up here as they happen.')}
              </Text>
              {error ? (
                <Pressable style={styles.retryBtn} onPress={onRefresh}>
                  <Icon name="refresh" size={16} color="#fff" />
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconBtn: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },

  // Controls
  controls: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },
  chipRow: { gap: 9, paddingRight: 16, paddingBottom: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: '800' },

  // Sections
  listContent: { padding: 16, paddingTop: 18, paddingBottom: 100, flexGrow: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { fontSize: 11, fontWeight: '800' },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  timeAgo: { fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '800', marginTop: 3, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12.5, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  cardDate: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  chevron: { marginLeft: 2 },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 70, paddingHorizontal: 30 },
  emptyIcon: { width: 90, height: 90, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptyMessage: { fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 20, fontWeight: '500' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
    backgroundColor: '#4338ca',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});

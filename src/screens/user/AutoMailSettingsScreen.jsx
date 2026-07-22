import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import AppHeader from '../../components/AppHeader';
import { useSidebar } from '../../components/Sidebar';
import EmptyState from '../../components/EmptyState';
import { autoMailApi } from '../../api/autoMailApi';
import { rentApi } from '../../api/rentApi';
import { colors } from '../../utils/constants';
import { dateText, getMessage } from '../../utils/helpers';

const defaults = {
  isEnabled: false,
  sendArrears: false, sendOverdue: false, sendUpcoming: false, sendAdvancePending: false,
  timeArrears: '09:00', timeOverdue: '10:00', timeUpcoming: '11:00', timeAdvancePending: '12:00',
  lastRunArrears: null, lastRunOverdue: null, lastRunUpcoming: null, lastRunAdvancePending: null,
};

const mins = value => { const [hour, minute] = String(value || '').split(':').map(Number); return hour * 60 + minute; };
const lastRunText = value => value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not run yet';
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const autoMailCache = {
  hasData: false,
  config: defaults,
  groups: { arrears: [], overdue: [], upcoming: [], advance: [] },
};

function TimeSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, TIME_OPTIONS.indexOf(value));

  const choose = next => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable disabled={disabled} style={[styles.timeSelect, disabled && styles.timeSelectDisabled]} onPress={() => setOpen(true)}>
        <View style={styles.timeIcon}><Icon name="clock-outline" size={18} color={colors.primary} /></View>
        <View style={styles.flex}>
          <Text style={styles.timeLabel}>Scheduled Time</Text>
          <Text style={styles.timeValue}>{value || 'Select time'}</Text>
        </View>
        <Icon name="chevron-down" size={20} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.timeModal}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Select Time</Text>
                <Text style={styles.muted}>15-minute intervals</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
                <Icon name="close" size={21} color={colors.muted} />
              </Pressable>
            </View>
            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={item => item}
              initialScrollIndex={selectedIndex}
              getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable style={[styles.timeOption, selected && styles.timeOptionSelected]} onPress={() => choose(item)}>
                    <Icon name={selected ? 'radiobox-marked' : 'clock-time-four-outline'} size={20} color={selected ? colors.primary : colors.muted} />
                    <Text style={[styles.timeOptionText, selected && { color: colors.primary }]}>{item}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

function Policy({ icon, title, description, color, count, enabled, time, lastRun, masterEnabled, onEnabled, onTime }) {
  return (
    <View style={[styles.policy, !masterEnabled && styles.disabled]}>
      <View style={styles.policyTop}>
        <View style={[styles.policyIcon, { backgroundColor: `${color}15` }]}><Icon name={icon} size={21} color={color} /></View>
        <View style={styles.flex}><View style={styles.titleLine}><Text style={styles.policyTitle}>{title}</Text><Text style={[styles.count, { color, backgroundColor: `${color}15` }]}>{count}</Text></View><Text style={styles.muted}>{description}</Text></View>
        <Switch value={enabled} disabled={!masterEnabled} onValueChange={onEnabled} trackColor={{ false: '#d1d5db', true: `${color}80` }} thumbColor={enabled ? color : '#f3f4f6'} />
      </View>
      {enabled && masterEnabled ? <View style={styles.timeBox}><View style={styles.flex}><TimeSelect value={time} onChange={onTime} /></View><View style={styles.lastRun}><Text style={styles.lastLabel}>LAST RUN</Text><Text style={styles.lastValue}>{lastRunText(lastRun)}</Text></View></View> : null}
    </View>
  );
}

function TargetGroup({ title, icon, color, tenants, lastRun }) {
  if (!tenants.length) return null;
  return <View style={styles.targetGroup}><View style={styles.groupHead}><Icon name={icon} size={18} color={color} /><Text style={styles.groupTitle}>{title} ({tenants.length})</Text></View>{tenants.map(tenant => <View style={styles.tenantRow} key={tenant._id}><View style={[styles.avatar, { backgroundColor: `${color}18` }]}><Text style={[styles.avatarText, { color }]}>{tenant.name?.[0]?.toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.tenantName}>{tenant.name}</Text><Text style={styles.muted}>{tenant.email || tenant.phone}</Text></View><View style={styles.sentBox}><Text style={styles.sentLabel}>{lastRun ? 'LAST RUN' : 'NOT SENT'}</Text><Text style={styles.sentDate}>{lastRun ? dateText(lastRun) : ''}</Text></View></View>)}</View>;
}

function AutoMailDataSkeleton() {
  return (
    <View pointerEvents="none">
      <AppCard>
        <View style={styles.masterRow}>
          <View style={[styles.skeletonBlock, { width: 44, height: 44, borderRadius: 13 }]} />
          <View style={styles.flex}>
            <View style={[styles.skeletonBlock, { width: '40%', height: 16 }]} />
            <View style={[styles.skeletonBlock, { width: '70%', height: 11, marginTop: 4 }]} />
          </View>
        </View>
      </AppCard>
      <AppCard>
        <View style={styles.cardHead}>
          <View style={[styles.skeletonBlock, { width: 23, height: 23 }]} />
          <View style={[styles.skeletonBlock, { width: '40%', height: 16 }]} />
        </View>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.policy, { marginBottom: 11 }]}>
            <View style={styles.policyTop}>
              <View style={[styles.skeletonBlock, { width: 40, height: 40, borderRadius: 11 }]} />
              <View style={styles.flex}>
                <View style={[styles.skeletonBlock, { width: '50%', height: 13 }]} />
                <View style={[styles.skeletonBlock, { width: '60%', height: 10, marginTop: 4 }]} />
              </View>
            </View>
          </View>
        ))}
      </AppCard>
    </View>
  );
}

export default function AutoMailSettingsScreen({ onLogout }) {
  const { open } = useSidebar();
  const [config, setConfig] = useState(autoMailCache.config);
  const [groups, setGroups] = useState(autoMailCache.groups);
  const [dataLoading, setDataLoading] = useState(!autoMailCache.hasData);
  const [dataError, setDataError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const hasLoadedRef = useRef(autoMailCache.hasData);
  const loadRequestRef = useRef(0);

  const load = useCallback(async (options = {}) => {
    const requestId = ++loadRequestRef.current;
    if (!options.background) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const [saved, rent] = await Promise.all([autoMailApi.getConfig(), rentApi.all()]);
      if (requestId !== loadRequestRef.current) return;
      const next = { arrears: [], overdue: [], upcoming: [], advance: [] };
      (Array.isArray(rent) ? rent : []).forEach(item => {
        if (!item?.tenant || Number(item.totalAccumulatedDue || 0) <= 0) return;
        const rentOutstanding = Number(item.arrearsTotal || 0) + Number(item.remaining || 0);
        if (Number(item.pendingAdvanceAmount ?? item.advancePending ?? 0) > 0 && rentOutstanding <= 0) next.advance.push(item.tenant);
        else if (item.hasPreviousPending) next.arrears.push(item.tenant);
        else if (item.isOverdue) next.overdue.push(item.tenant);
        else if (item.daysUntilDue != null && item.daysUntilDue <= 5) next.upcoming.push(item.tenant);
      });
      const safeConfig = { ...defaults, ...saved };
      setConfig(safeConfig);
      setGroups(next);

      autoMailCache.hasData = true;
      autoMailCache.config = safeConfig;
      autoMailCache.groups = next;
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

  useFocusEffect(useCallback(() => {
    load({ background: hasLoadedRef.current || autoMailCache.hasData })
      .then(() => { hasLoadedRef.current = true; });
  }, [load]));

  const validate = () => {
    if (!config.isEnabled) return true;
    const active = [];
    if (config.sendArrears) active.push(['Arrears', config.timeArrears]);
    if (config.sendOverdue) active.push(['Overdue', config.timeOverdue]);
    if (config.sendUpcoming) active.push(['Upcoming', config.timeUpcoming]);
    if (config.sendAdvancePending) active.push(['Advance Pending', config.timeAdvancePending]);
    for (let i = 0; i < active.length; i++) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(active[i][1] || '')) { Alert.alert('Invalid time', `${active[i][0]} requires a valid 24-hour time such as 09:00.`); return false; }
      for (let j = i + 1; j < active.length; j++) { let diff = Math.abs(mins(active[i][1]) - mins(active[j][1])); if (diff > 720) diff = 1440 - diff; if (diff < 30) { Alert.alert('Schedule conflict', `Keep at least a 30-minute gap between ${active[i][0]} and ${active[j][0]}.`); return false; } }
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await autoMailApi.saveConfig(config);
      autoMailCache.config = config;
      Alert.alert('Saved', 'Auto email settings updated successfully.');
    }
    catch (error) { Alert.alert('Save failed', getMessage(error)); }
    finally { setSaving(false); }
  };

  const hasData = autoMailCache.hasData;
  const showSkeleton = dataLoading && !hasData;
  const showError = !!dataError && !dataLoading && !hasData;

  const noPolicies = !config.sendArrears && !config.sendOverdue && !config.sendUpcoming && !config.sendAdvancePending;

  return (
    <View style={styles.screen}>
      <AppHeader title="Auto Email Setup" subtitle="Automated tenant rent reminders" onMenu={open} onLogout={onLogout} showOnboardingNotifications />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {showSkeleton ? (
          <AutoMailDataSkeleton />
        ) : showError ? (
          <EmptyState title="Unable to load auto mail setup" message={dataError} icon="wifi-alert" />
        ) : (
          <>
            <AppCard>
              <View style={styles.masterRow}>
                <View style={styles.masterIcon}>
                  <Icon name="lightning-bolt-outline" size={24} color={colors.violet} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Master Scheduler</Text>
                  <Text style={styles.muted}>Turn the entire automation system on or off</Text>
                </View>
                <Switch value={config.isEnabled} onValueChange={value => set('isEnabled', value)} trackColor={{ false: '#d1d5db', true: '#a78bfa' }} thumbColor={config.isEnabled ? colors.violet : '#f3f4f6'} />
              </View>
            </AppCard>
            <AppCard>
              <View style={styles.cardHead}>
                <Icon name="bell-outline" size={23} color={colors.accent} />
                <Text style={styles.cardTitle}>Reminder Policies</Text>
              </View>
              <Policy icon="alert-decagram-outline" title="Previous Arrears" description="Past unpaid months" count={groups.arrears.length} color={colors.danger} enabled={config.sendArrears} time={config.timeArrears} lastRun={config.lastRunArrears} masterEnabled={config.isEnabled} onEnabled={v => set('sendArrears', v)} onTime={v => set('timeArrears', v)} />
              <Policy icon="clock-alert-outline" title="Current Overdue" description="Current rent crossed its due date" count={groups.overdue.length} color={colors.warning} enabled={config.sendOverdue} time={config.timeOverdue} lastRun={config.lastRunOverdue} masterEnabled={config.isEnabled} onEnabled={v => set('sendOverdue', v)} onTime={v => set('timeOverdue', v)} />
              <Policy icon="calendar-clock-outline" title="Upcoming / Due" description="Due today or within five days" count={groups.upcoming.length} color={colors.info} enabled={config.sendUpcoming} time={config.timeUpcoming} lastRun={config.lastRunUpcoming} masterEnabled={config.isEnabled} onEnabled={v => set('sendUpcoming', v)} onTime={v => set('timeUpcoming', v)} />
              <Policy icon="credit-card-clock-outline" title="Advance Payment Pending" description="Rent is clear; advance remains" count={groups.advance.length} color={colors.violet} enabled={config.sendAdvancePending} time={config.timeAdvancePending} lastRun={config.lastRunAdvancePending} masterEnabled={config.isEnabled} onEnabled={v => set('sendAdvancePending', v)} onTime={v => set('timeAdvancePending', v)} />
              <AppButton title="Save Changes" icon="content-save-outline" loading={saving} onPress={save} />
            </AppCard>
            <AppCard>
              <View style={styles.cardHead}>
                <Icon name="email-check-outline" size={23} color={colors.success} />
                <View>
                  <Text style={styles.cardTitle}>Targeted Mail Status</Text>
                  <Text style={styles.muted}>Groups configured to receive reminders</Text>
                </View>
              </View>
              {noPolicies ? (
                <View style={styles.noPolicies}>
                  <Icon name="email-off-outline" size={34} color={colors.muted} />
                  <Text style={styles.noTitle}>No policies are active</Text>
                </View>
              ) : (
                <>
                  {config.sendArrears ? <TargetGroup title="Arrears Targets" icon="alert-decagram-outline" color={colors.danger} tenants={groups.arrears} lastRun={config.lastRunArrears} /> : null}
                  {config.sendOverdue ? <TargetGroup title="Overdue Targets" icon="clock-alert-outline" color={colors.warning} tenants={groups.overdue} lastRun={config.lastRunOverdue} /> : null}
                  {config.sendUpcoming ? <TargetGroup title="Upcoming Targets" icon="calendar-clock-outline" color={colors.info} tenants={groups.upcoming} lastRun={config.lastRunUpcoming} /> : null}
                  {config.sendAdvancePending ? <TargetGroup title="Advance Pending Targets" icon="credit-card-clock-outline" color={colors.violet} tenants={groups.advance} lastRun={config.lastRunAdvancePending} /> : null}
                </>
              )}
            </AppCard>
          </>
        )}
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, body: { padding: 16 }, flex: { flex: 1 }, footer: { height: 90 }, muted: { fontSize: 11, color: colors.muted, marginTop: 2 }, cardTitle: { fontSize: 16, fontWeight: '900', color: colors.text }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }, masterRow: { flexDirection: 'row', alignItems: 'center', gap: 11 }, masterIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center' }, policy: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 11 }, disabled: { opacity: .5 }, policyTop: { flexDirection: 'row', alignItems: 'center', gap: 9 }, policyIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, titleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 }, policyTitle: { color: colors.text, fontSize: 13, fontWeight: '900' }, count: { fontSize: 10, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' }, timeBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }, timeSelect: { height: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.faint, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 }, timeSelectDisabled: { opacity: .5 }, timeIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, timeLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, timeValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.5)' }, timeModal: { height: '64%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 26 }, modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' }, closeButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.faint, alignItems: 'center', justifyContent: 'center' }, timeOption: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, marginBottom: 6, backgroundColor: colors.faint, borderWidth: 1, borderColor: colors.border }, timeOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, timeOptionText: { color: colors.text, fontSize: 15, fontWeight: '800' }, lastRun: { width: 92 }, lastLabel: { fontSize: 9, color: colors.muted, fontWeight: '800' }, lastValue: { fontSize: 10, color: colors.text, fontWeight: '700', marginTop: 3 }, targetGroup: { marginTop: 8, marginBottom: 14 }, groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }, groupTitle: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }, tenantRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontWeight: '900' }, tenantName: { fontSize: 13, color: colors.text, fontWeight: '800' }, sentBox: { alignItems: 'flex-end' }, sentLabel: { fontSize: 9, color: colors.success, fontWeight: '900' }, sentDate: { fontSize: 9, color: colors.muted, marginTop: 2 }, noPolicies: { alignItems: 'center', paddingVertical: 24, backgroundColor: colors.faint, borderRadius: 13 }, noTitle: { color: colors.muted, fontWeight: '800', marginTop: 7 },
  skeletonBlock: { backgroundColor: '#e4e8ef', borderRadius: 8 },
});

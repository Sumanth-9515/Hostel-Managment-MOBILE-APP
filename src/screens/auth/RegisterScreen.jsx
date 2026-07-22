import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import { getMessage } from '../../utils/helpers';

const appLogo = require('../../../assets/app-logo-transparent.png');

// Shared login/register theme (teal), scoped locally so the rest of the app is untouched.
const theme = {
  bg: '#e9f4f2',
  card: '#ffffff',
  border: '#d4e6e4',
  teal: '#4f9aa3',
  tealDark: '#3f828a',
  heading: '#16263a',
  label: '#1f2d3d',
  muted: '#5e7077',
  icon: '#7e8d94',
};

const empty = { name: '', owner: '', ph: '', email: '', password: '', address: '', planId: '' };

function Field({ icon, label, multiline, rightIcon, onRightPress, error, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline, error && styles.inputWrapError]}>
        <Icon name={icon} size={20} color={error ? '#ef4444' : theme.icon} style={multiline ? styles.iconTop : null} />
        <TextInput
          placeholderTextColor="#9aa8ad"
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline]}
          {...inputProps}
        />
        {rightIcon ? (
          <Pressable onPress={onRightPress} hitSlop={8}>
            <Icon name={rightIcon} size={20} color={theme.icon} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function RegisterScreen({ navigation, onAuth }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const loadPlans = useCallback(() => {
    setPlansLoading(true);
    setPlansError(false);
    masterApi.plans()
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.plans || data?.data || []);
        const active = list.filter(p => p?.isActive !== false);
        setPlans(active);
        setForm(prev => {
          const defaultPlanId = (active.find(p => p.isFree) || active[0])?._id || '';
          return prev.planId ? prev : { ...prev, planId: defaultPlanId };
        });
      })
      .catch(() => setPlansError(true))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const validateForm = () => {
    const nextErrors = {};

    // Hostel Name Validation
    if (!form.name.trim()) {
      nextErrors.name = 'Hostel Name is required.';
    } else if (form.name.trim().length < 3) {
      nextErrors.name = 'Hostel Name must be at least 3 characters.';
    }

    // Owner Name Validation
    if (!form.owner.trim()) {
      nextErrors.owner = 'Owner Name is required.';
    } else if (form.owner.trim().length < 3) {
      nextErrors.owner = 'Owner Name must be at least 3 characters.';
    }

    // Phone Validation
    const phoneDigits = form.ph.trim().replace(/\D/g, '');
    if (!form.ph.trim()) {
      nextErrors.ph = 'Phone number is required.';
    } else if (phoneDigits.length !== 10) {
      nextErrors.ph = 'Phone number must be exactly 10 digits.';
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      nextErrors.email = 'Email address is required.';
    } else if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    // Password Validation
    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (form.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.';
    }

    // Address Validation
    if (!form.address.trim()) {
      nextErrors.address = 'Address is required.';
    } else if (form.address.trim().length < 10) {
      nextErrors.address = 'Address must be at least 10 characters.';
    }

    // Plan Validation
    if (!form.planId) {
      nextErrors.planId = 'Please select a plan to continue.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validateForm()) {
      return Alert.alert('Invalid form', 'Please check the marked errors before submitting.');
    }

    const body = {
      name: form.name.trim(),
      owner: form.owner.trim(),
      ph: form.ph.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      address: form.address.trim(),
      planId: form.planId || undefined,
    };

    setLoading(true);
    try {
      const data = await authApi.register(body);
      if (data.pending) {
        Alert.alert('Registration pending', data.message || 'Your account is pending approval.');
        navigation.navigate('Login');
      } else {
        await onAuth({ token: data.token, user: data.user });
      }
    } catch (error) {
      Alert.alert('Registration failed', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Icon name="home-variant-outline" size={240} color={theme.teal} style={styles.watermarkTop} />
      <Icon name="home-variant-outline" size={220} color={theme.teal} style={styles.watermarkBottom} />

      <KeyboardAvoid style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image source={appLogo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.welcome}>Create Account</Text>
          <Text style={styles.tagline}>Register your hostel to get started</Text>

          <Field icon="office-building-outline" label="Hostel Name" value={form.name} onChangeText={v => set('name', v)} error={errors.name} placeholder="e.g. Nilayam Residency" />
          <Field icon="account-outline" label="Owner Name" value={form.owner} onChangeText={v => set('owner', v)} error={errors.owner} placeholder="Owner full name" />
          <Field icon="phone-outline" label="Phone" value={form.ph} onChangeText={v => set('ph', v)} keyboardType="phone-pad" error={errors.ph} placeholder="10-digit phone" />
          <Field icon="email-outline" label="Email" value={form.email} onChangeText={v => set('email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors.email} placeholder="hello@nilayam.com" />
          <Field
            icon="lock-outline"
            label="Password"
            value={form.password}
            onChangeText={v => set('password', v)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            error={errors.password}
            placeholder="Create a password"
            rightIcon={showPassword ? 'eye-outline' : 'eye-off-outline'}
            onRightPress={() => setShowPassword(v => !v)}
          />
          <Field icon="map-marker-outline" label="Address" value={form.address} onChangeText={v => set('address', v)} multiline error={errors.address} placeholder="Hostel address" />

          {/* Plans */}
          <View style={styles.planHead}>
            <Text style={styles.label}>Choose a Plan</Text>
            {errors.planId ? (
              <Text style={styles.planErrorText}>{errors.planId}</Text>
            ) : !plansLoading && !plansError ? (
              <Text style={styles.planCount}>{plans.length} available</Text>
            ) : null}
          </View>

          {plansLoading ? (
            <View style={styles.planLoading}>
              <ActivityIndicator color={theme.teal} />
              <Text style={styles.planLoadingText}>Loading plans…</Text>
            </View>
          ) : plansError ? (
            <Pressable style={styles.planRetry} onPress={loadPlans}>
              <Icon name="refresh" size={18} color={theme.tealDark} />
              <Text style={styles.planRetryText}>Couldn't load plans. Tap to retry</Text>
            </Pressable>
          ) : plans.length === 0 ? (
            <Text style={styles.planEmpty}>No plans available right now.</Text>
          ) : (
            <View style={styles.planList}>
              {plans.map(plan => {
                const selected = form.planId === plan._id;
                return (
                  <Pressable key={plan._id} style={[styles.planCard, selected && styles.planCardActive]} onPress={() => set('planId', plan._id)}>
                    <View style={styles.planRadio}>
                      <Icon name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={selected ? theme.teal : '#aebcc1'} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.planName, selected && styles.planNameActive]}>{plan.name}</Text>
                      <Text style={styles.planMeta}>{plan.days} days · {plan.beds} beds</Text>
                    </View>
                    <Text style={[styles.planPrice, selected && styles.planNameActive]}>{Number(plan.price) > 0 ? `Rs. ${plan.price}` : 'Free'}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Register</Text>}
          </Pressable>

          <Pressable style={styles.bottomLink} onPress={() => navigation.goBack()}>
            <Text style={styles.bottomText}>Already have an account? <Text style={styles.bottomStrong}>Sign in</Text></Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoid>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 8, paddingBottom: 30 },

  watermarkTop: { position: 'absolute', top: -40, right: -70, opacity: 0.05 },
  watermarkBottom: { position: 'absolute', bottom: 20, left: -70, opacity: 0.05 },

  logo: { width: 150, height: 96, alignSelf: 'center', marginBottom: 4 },
  welcome: { color: theme.heading, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  tagline: { color: theme.muted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 5, marginBottom: 20 },

  field: { marginBottom: 14 },
  label: { color: theme.label, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    borderRadius: 16, paddingHorizontal: 16, minHeight: 54,
    shadowColor: '#1f5b5e', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  inputWrapMultiline: { alignItems: 'flex-start', paddingVertical: 14 },
  inputWrapError: { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 4, fontWeight: '600' },
  iconTop: { marginTop: 2 },
  input: { flex: 1, color: theme.heading, fontSize: 16, paddingVertical: 0 },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },

  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
  planCount: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  planErrorText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  planLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  planLoadingText: { color: theme.muted, fontSize: 14, fontWeight: '600' },
  planRetry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card },
  planRetryText: { color: theme.tealDark, fontSize: 14, fontWeight: '700' },
  planEmpty: { color: theme.muted, fontSize: 14, paddingVertical: 14, textAlign: 'center' },
  planList: { gap: 10 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.card,
    borderWidth: 1.5, borderColor: theme.border, borderRadius: 16, padding: 14,
  },
  planCardActive: { borderColor: theme.teal, backgroundColor: '#f0f8f7' },
  planRadio: { marginRight: 4 },
  planName: { color: theme.heading, fontSize: 15, fontWeight: '800' },
  planNameActive: { color: theme.tealDark },
  planMeta: { color: theme.muted, fontSize: 12, marginTop: 2, fontWeight: '600' },
  planPrice: { color: theme.heading, fontSize: 15, fontWeight: '900' },

  primaryBtn: {
    height: 56, borderRadius: 30, backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center', marginTop: 22,
    shadowColor: theme.tealDark, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  primaryBtnPressed: { backgroundColor: theme.tealDark },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  bottomLink: { alignSelf: 'center', marginTop: 18 },
  bottomText: { color: theme.muted, fontSize: 14 },
  bottomStrong: { color: theme.tealDark, fontWeight: '800' },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '../../components/AppButton';
import AppCard from '../../components/AppCard';
import KeyboardAvoid from '../../components/KeyboardAvoid';
import { authApi } from '../../api/authApi';
import { masterApi } from '../../api/masterApi';
import { getMessage } from '../../utils/helpers';

const appLogo = require('../../../assets/app-logo-transparent.png');

// Login-screen theme (teal), scoped locally so the rest of the app is untouched.
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

const HELP_PHONE = '9515174064';
const HELP_MESSAGE = 'Hello, I need help with the Nilayam Hostel Management app.';

export default function LoginScreen({ navigation, onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [expired, setExpired] = useState(null);
  // UI-only state (no auth logic change)
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    masterApi.plans().then(setPlans).catch(() => {});
  }, []);

  const submit = async () => {
    if (!email || !password) return Alert.alert('Missing details', 'Email and password are required.');
    setLoading(true);
    try {
      const data = await authApi.login({ email: email.trim().toLowerCase(), password });
      await onAuth({ token: data.token, user: data.user });
    } catch (error) {
      const body = error?.response?.data;
      if (body?.planExpired) setExpired(body);
      Alert.alert('Login failed', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const requestPlan = async planId => {
    if (!expired?.userId) return;
    setLoading(true);
    try {
      const data = await authApi.requestExtension({ userId: expired.userId, planId });
      Alert.alert('Request sent', data.message || 'Extension request submitted.');
      setExpired(null);
    } catch (error) {
      Alert.alert('Unable to request', getMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const callAdmin = () => { setHelpOpen(false); Linking.openURL(`tel:${HELP_PHONE}`).catch(() => {}); };
  const whatsappAdmin = () => {
    setHelpOpen(false);
    Linking.openURL(`https://wa.me/91${HELP_PHONE}?text=${encodeURIComponent(HELP_MESSAGE)}`).catch(() => Alert.alert('WhatsApp', 'Unable to open WhatsApp.'));
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* faint house watermarks */}
      <Icon name="home-variant-outline" size={240} color={theme.teal} style={styles.watermarkTop} />
      <Icon name="home-variant-outline" size={220} color={theme.teal} style={styles.watermarkBottom} />

      <KeyboardAvoid style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Image source={appLogo} style={styles.logo} resizeMode="contain" />

          <Text style={styles.welcome}>Welcome Back</Text>
          <Text style={styles.tagline}>Sign in to manage your hostel efficiently</Text>

          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Icon name="email-outline" size={20} color={theme.icon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="hello@nilayam.com"
              placeholderTextColor="#9aa8ad"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Icon name="lock-outline" size={20} color={theme.icon} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9aa8ad"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.input}
            />
            <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
              <Icon name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.icon} />
            </Pressable>
          </View>

          <Pressable style={styles.forgot} onPress={() => setHelpOpen(true)}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          <Pressable style={styles.remember} onPress={() => setRemember(v => !v)}>
            <View style={[styles.checkbox, remember && styles.checkboxOn]}>
              {remember ? <Icon name="check" size={14} color="#fff" /> : null}
            </View>
            <Text style={styles.rememberText}>Remember Me</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.loginBtn, pressed && styles.loginBtnPressed]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginText}>Login</Text>}
          </Pressable>

          <Pressable style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerText}>New here? <Text style={styles.registerStrong}>Create an account</Text></Text>
          </Pressable>

          {expired ? (
            <AppCard>
              <Text style={styles.planTitle}>Plan expired</Text>
              <Text style={styles.planMuted}>{expired.message}</Text>
              {plans.filter(p => !p.isFree && p.isActive !== false).map(plan => (
                <AppButton
                  key={plan._id}
                  title={`Request ${plan.name} - Rs. ${plan.price}`}
                  variant="secondary"
                  style={styles.planBtn}
                  onPress={() => requestPlan(plan._id)}
                />
              ))}
            </AppCard>
          ) : null}

          <View style={styles.flexSpacer} />

          <Pressable onPress={() => setHelpOpen(true)}>
            <Text style={styles.footer}>Need help? Contact Hostel Administration</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoid>

      {/* Help / contact admin popup */}
      <Modal visible={helpOpen} transparent animationType="fade" onRequestClose={() => setHelpOpen(false)}>
        <Pressable style={styles.helpBackdrop} onPress={() => setHelpOpen(false)}>
          <Pressable style={styles.helpCard} onPress={() => {}}>
            <View style={styles.helpIcon}><Icon name="headset" size={26} color={theme.teal} /></View>
            <Text style={styles.helpTitle}>Contact Hostel Administration</Text>
            <Text style={styles.helpNumber}>+91 {HELP_PHONE}</Text>

            <Pressable style={[styles.helpOption, styles.helpCall]} onPress={callAdmin}>
              <Icon name="phone" size={20} color="#16a34a" />
              <Text style={[styles.helpOptionText, styles.helpCallText]}>Call now</Text>
            </Pressable>
            <Pressable style={[styles.helpOption, styles.helpWa]} onPress={whatsappAdmin}>
              <Icon name="whatsapp" size={20} color="#1f9d52" />
              <Text style={[styles.helpOptionText, styles.helpWaText]}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.helpCancel} onPress={() => setHelpOpen(false)}>
              <Text style={styles.helpCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 26, paddingTop: 10, paddingBottom: 24 },

  watermarkTop: { position: 'absolute', top: -40, right: -70, opacity: 0.05 },
  watermarkBottom: { position: 'absolute', bottom: 40, left: -70, opacity: 0.05 },

  logo: { width: 200, height: 150, alignSelf: 'center', marginBottom: 6 },
  welcome: { color: theme.heading, fontSize: 34, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  tagline: { color: theme.muted, fontSize: 15, fontStyle: 'italic', textAlign: 'center', marginTop: 6, marginBottom: 26 },

  label: { color: theme.label, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border,
    borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 16,
    shadowColor: '#1f5b5e', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  input: { flex: 1, color: theme.heading, fontSize: 16, paddingVertical: 0 },

  forgot: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14 },
  forgotText: { color: theme.heading, fontSize: 14, fontWeight: '700' },

  remember: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#9fb6b8', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card },
  checkboxOn: { backgroundColor: theme.teal, borderColor: theme.teal },
  rememberText: { color: theme.label, fontSize: 15, fontWeight: '600' },

  loginBtn: {
    height: 56, borderRadius: 30, backgroundColor: theme.teal, alignItems: 'center', justifyContent: 'center',
    shadowColor: theme.tealDark, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5,
  },
  loginBtnPressed: { backgroundColor: theme.tealDark },
  loginText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },

  registerLink: { alignSelf: 'center', marginTop: 18 },
  registerText: { color: theme.muted, fontSize: 14 },
  registerStrong: { color: theme.tealDark, fontWeight: '800' },

  planTitle: { color: theme.heading, fontWeight: '900', fontSize: 17, marginBottom: 6 },
  planMuted: { color: theme.muted, marginBottom: 10 },
  planBtn: { marginTop: 8 },

  flexSpacer: { flexGrow: 1, minHeight: 24 },
  footer: { color: theme.muted, fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 16 },

  // Help popup
  helpBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,30,32,0.55)', padding: 28 },
  helpCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 22, padding: 22, alignItems: 'center' },
  helpIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  helpTitle: { color: theme.heading, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  helpNumber: { color: theme.muted, fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 18 },
  helpOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: 52, borderRadius: 14, marginBottom: 10 },
  helpCall: { backgroundColor: '#e7f7ed' },
  helpWa: { backgroundColor: '#e6f7ee' },
  helpOptionText: { fontSize: 15, fontWeight: '800' },
  helpCallText: { color: '#16a34a' },
  helpWaText: { color: '#1f9d52' },
  helpCancel: { paddingVertical: 8, marginTop: 2 },
  helpCancelText: { color: theme.muted, fontSize: 14, fontWeight: '700' },
});

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../utils/constants';

const sections = [
  {
    title: 'Your Privacy Is Important to Us',
    body: "Your privacy is very important to us. We collect and use your personal information only to provide, maintain, and improve Nilayam's hostel management services.",
  },
  {
    title: 'Your Personal Data Is Secure',
    body: 'Your name, phone number, email address, Aadhaar details, photos, and other personal information are stored securely in our databases with appropriate security measures.',
  },
  {
    title: 'We Do Not Sell or Misuse Your Data',
    body: 'We do not sell, rent, or trade your personal information to other companies or individuals. Your data is used only for legitimate Nilayam services and purposes.',
  },
  {
    title: 'Your Data Is Not Publicly Exposed',
    body: 'Your personal information, documents, photos, and other private details are not publicly published or exposed to unauthorized people. Access is limited to authorized users.',
  },
  {
    title: 'Aadhaar and Important Documents',
    body: 'Aadhaar details, identity documents, and other information you provide are used only for necessary verification and hostel management purposes and are not intentionally shared publicly.',
  },
  {
    title: 'Phone Numbers and Email Addresses',
    body: 'Your phone number and email address are kept private and may be used for account verification, important notifications, rent reminders, and other necessary service-related communication.',
  },
  {
    title: 'Tenant and Payment Information',
    body: 'Tenant details, room and bed information, rent records, payment status, and related information are securely maintained and accessible only to authorized users for hostel management.',
  },
  {
    title: 'Secure Systems and Limited Access',
    body: 'We use reasonable security practices, access controls, and secure systems to protect your information. Only authorized users or personnel can access data when it is necessary to provide our services.',
  },
  {
    title: 'Trusted Third-Party Services',
    body: 'We may use trusted third-party services for secure hosting, database storage, authentication, notifications, communication, and other technical services. Only necessary information may be shared for providing these services.',
  },
  {
    title: 'Our Commitment to Your Privacy',
    body: 'We are committed to protecting your personal information. We do not intentionally publish, expose, sell, or misuse your data, and we take reasonable steps to keep your personal information safe and secure.',
  },
];

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Privacy Policy</Text>
          <Text style={styles.subtitle}>Nilayam Hostel Management</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.body}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="shield-lock-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Nilayam Privacy Policy</Text>
          <Text style={styles.heroText}>
            We protect hostel, tenant, document, and payment information with responsible access and security practices.
          </Text>
        </View>

        {sections.map((item, index) => (
          <View key={item.title} style={styles.card}>
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Icon name="lock-check-outline" size={18} color={colors.success} />
          <Text style={styles.footerText}>Last updated for Nilayam app users.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.faint,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  body: {
    padding: 16,
    paddingBottom: 30,
  },
  hero: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: 12,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  numberText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  cardBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  footerText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
  },
});

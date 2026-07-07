import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomTabBar from '../components/CustomTabBar';
import { OnboardingNotificationsProvider } from '../components/OnboardingNotifications';
import { SidebarProvider } from '../components/Sidebar';
import DashboardScreen from '../screens/user/DashboardScreen';
import OverviewScreen from '../screens/user/OverviewScreen';
import AddHostelScreen from '../screens/user/AddHostelScreen';
import AddCandidateScreen from '../screens/user/AddCandidateScreen';
import CandidatesScreen from '../screens/user/CandidatesScreen';
import RentManagementScreen from '../screens/user/RentManagementScreen';
import TenantDetailsScreen from '../screens/user/TenantDetailsScreen';
import OnboardingScreen from '../screens/user/OnboardingScreen';
import ActivityLogsScreen from '../screens/user/ActivityLogsScreen';
import AutoMailSettingsScreen from '../screens/user/AutoMailSettingsScreen';
import ProfileScreen from '../screens/user/ProfileScreen';
import OwnerSearchScreen from '../screens/user/OwnerSearchScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Bottom bar: Dashboard, Rent Payments, Onboard Form, My Hostels, AutoMail Settings.
function Tabs({ onLogout, user }) {
  const wrap = (Component, extra = {}) => props => <Component {...props} {...extra} onLogout={onLogout} user={user} />;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={props => <CustomTabBar {...props} />}>
      <Tab.Screen name="Dashboard">{wrap(DashboardScreen)}</Tab.Screen>
      <Tab.Screen name="Rent">{wrap(RentManagementScreen)}</Tab.Screen>
      <Tab.Screen name="Onboarding">{wrap(OnboardingScreen)}</Tab.Screen>
      <Tab.Screen name="Hostels">{wrap(AddHostelScreen)}</Tab.Screen>
      <Tab.Screen name="AutoMail">{wrap(AutoMailSettingsScreen)}</Tab.Screen>
    </Tab.Navigator>
  );
}

export default function UserNavigator({ onLogout, onUserUpdate, user }) {
  return (
    <OnboardingNotificationsProvider user={user}>
      <SidebarProvider user={user} onLogout={onLogout}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="UserTabs">{props => <Tabs {...props} onLogout={onLogout} user={user} />}</Stack.Screen>
          <Stack.Screen name="AddCandidate">{props => <AddCandidateScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="Candidates">{props => <CandidatesScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="TenantDetails">{props => <TenantDetailsScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="OwnerSearch">{props => <OwnerSearchScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="Overview">{props => <OverviewScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="ActivityLogs">{props => <ActivityLogsScreen {...props} onLogout={onLogout} />}</Stack.Screen>
          <Stack.Screen name="Profile">{props => <ProfileScreen {...props} onLogout={onLogout} onUserUpdate={onUserUpdate} />}</Stack.Screen>
        </Stack.Navigator>
      </SidebarProvider>
    </OnboardingNotificationsProvider>
  );
}

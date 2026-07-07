import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';
import MasterDashboardScreen from '../screens/master/MasterDashboardScreen';
import MasterUsersScreen from '../screens/master/MasterUsersScreen';
import MasterPlansScreen from '../screens/master/MasterPlansScreen';
import MasterApprovalsScreen from '../screens/master/MasterApprovalsScreen';

const Tab = createBottomTabNavigator();

export default function MasterNavigator({ onLogout }) {
  const screen = Component => props => <Component {...props} onLogout={onLogout} />;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarIcon: ({ color, size }) => {
          const icons = { MasterDashboard: 'shield-crown', MasterUsers: 'account-multiple', MasterPlans: 'clipboard-list', MasterApprovals: 'check-decagram' };
          return <Icon name={icons[route.name]} color={color} size={size} />;
        },
      })}>
      <Tab.Screen name="MasterDashboard" options={{ title: 'Dashboard' }}>{screen(MasterDashboardScreen)}</Tab.Screen>
      <Tab.Screen name="MasterUsers" options={{ title: 'Users' }}>{screen(MasterUsersScreen)}</Tab.Screen>
      <Tab.Screen name="MasterPlans" options={{ title: 'Plans' }}>{screen(MasterPlansScreen)}</Tab.Screen>
      <Tab.Screen name="MasterApprovals" options={{ title: 'Approvals' }}>{screen(MasterApprovalsScreen)}</Tab.Screen>
    </Tab.Navigator>
  );
}

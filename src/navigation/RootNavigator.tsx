import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

// Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import HomeScreen from '@/screens/Home/HomeScreen';
import ChatListScreen from '@/screens/Chat/ChatListScreen';
import ChatScreen from '@/screens/Chat/ChatScreen';
import OmzoScreen from '@/screens/Omzo/OmzoScreen';
import ExploreScreen from '@/screens/Explore/ExploreScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';
import UploadScreen from '@/screens/Upload/UploadScreen';
import CreateScribeScreen from '@/screens/Scribe/CreateScribeScreen';
import CreateStoryScreen from '@/screens/Story/CreateStoryScreen';
import StoryViewScreen from '@/screens/Story/StoryViewScreen';
import NotificationsScreen from '@/screens/Notifications/NotificationsScreen';
import SearchScreen from '@/screens/Search/SearchScreen';
import SettingsScreen from '@/screens/Settings/SettingsScreen';

export type RootStackParamList = {
    Login: undefined;
    Main: undefined;
    Chat: { chatId: number };
    CreateScribe: undefined;
    CreateStory: undefined;
    StoryView: { userId: number };
    Profile: { username: string };
    Search: undefined;
    Settings: undefined;
    Notifications: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Omzo: undefined;
    Upload: undefined;
    Explore: undefined;
    MyProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBarButton({ children, onPress }: any) {
    return (
        <TouchableOpacity
            style={{
                justifyContent: 'center',
                alignItems: 'center',
            }}
            onPress={onPress}
        >
            <View
                style={{
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    backgroundColor: '#3B82F6',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: -10,
                }}
            >
                {children}
            </View>
        </TouchableOpacity>
    );
}

function MainTabs() {
    const { colors } = useThemeStore();

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E7EB',
                    borderTopWidth: 1,
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 65,
                },
                tabBarActiveTintColor: '#3B82F6',
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
                headerStyle: {
                    backgroundColor: colors.surface,
                },
                headerTintColor: colors.text,
                headerShadowVisible: false,
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <Icon name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Omzo"
                component={OmzoScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <Icon name={focused ? 'tv' : 'tv-outline'} size={24} color={color} />
                    ),
                    headerShown: false,
                }}
            />
            <Tab.Screen
                name="Upload"
                component={UploadScreen}
                options={{
                    headerShown: false,
                    tabBarLabel: '',
                    tabBarButton: (props) => <CustomTabBarButton {...props} />,
                    tabBarIcon: () => (
                        <Icon
                            name="add"
                            size={30}
                            color="#FFFFFF"
                            marginTop={9}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Explore"
                component={ExploreScreen}
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <Icon name={focused ? 'compass' : 'compass-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="MyProfile"
                component={ProfileScreen}
                options={{
                    title: 'Profile',
                    headerShown: false,
                    tabBarIcon: ({ color, focused }) => (
                        <Icon name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

export function RootNavigator() {
    const { isAuthenticated } = useAuthStore();
    const { colors } = useThemeStore();

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: colors.surface,
                    },
                    headerTintColor: colors.text,
                    headerShadowVisible: false,
                    contentStyle: {
                        backgroundColor: colors.background,
                    },
                }}
            >
                {!isAuthenticated ? (
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                ) : (
                    <>
                        <Stack.Screen
                            name="Main"
                            component={MainTabs}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Chat"
                            component={ChatScreen}
                            options={{ title: 'Chat' }}
                        />
                        <Stack.Screen
                            name="CreateScribe"
                            component={CreateScribeScreen}
                            options={{ title: 'Create Post' }}
                        />
                        <Stack.Screen
                            name="CreateStory"
                            component={CreateStoryScreen}
                            options={{ title: 'Create Story', headerShown: false }}
                        />
                        <Stack.Screen
                            name="StoryView"
                            component={StoryViewScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Profile"
                            component={ProfileScreen}
                            options={{ title: 'Profile' }}
                        />
                        <Stack.Screen
                            name="Search"
                            component={SearchScreen}
                            options={{ title: 'Search' }}
                        />
                        <Stack.Screen
                            name="Notifications"
                            component={NotificationsScreen}
                            options={{ title: 'Notifications' }}
                        />
                        <Stack.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

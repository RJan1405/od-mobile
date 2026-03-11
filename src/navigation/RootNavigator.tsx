import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import CreateActionModal from '@/components/CreateActionModal';

// Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import HomeScreen from '@/screens/Home/HomeScreen';
import ChatListScreen from '@/screens/Chat/ChatListScreen';
import ChatScreen from '@/screens/Chat/ChatScreen';
import OmzoScreen from '@/screens/Omzo/OmzoScreen';
import OmzoViewerScreen from '@/screens/Omzo/OmzoViewerScreen';
import CreateOmzoScreen from '@/screens/Omzo/CreateOmzoScreen';
import ExploreScreen from '@/screens/Explore/ExploreScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';
import UploadScreen from '@/screens/Upload/UploadScreen';
import CreateScribeScreen from '@/screens/Scribe/CreateScribeScreen';
import CreateStoryScreen from '@/screens/Story/CreateStoryScreen';
import StoryViewScreen from '@/screens/Story/StoryViewScreen';
import NotificationsScreen from '@/screens/Notifications/NotificationsScreen';
import SearchScreen from '@/screens/Search/SearchScreen';
import SettingsScreen from '@/screens/Settings/SettingsScreen';
import VoiceCallScreen from '@/screens/Call/VoiceCallScreen';
import VideoCallScreen from '@/screens/Call/VideoCallScreen';
import EditProfileScreen from '@/screens/Profile/EditProfileScreen';

export type RootStackParamList = {
    Login: undefined;
    Main: undefined;
    Chat: { chatId: number };
    CreateScribe: undefined;
    CreateOmzo: undefined;
    CreateStory: undefined;
    StoryView: { userId: number };
    Profile: { username: string };
    Search: undefined;
    Settings: undefined;
    Notifications: undefined;
    OmzoViewer: { omzo: any };
    VoiceCall: { user: any };
    VideoCall: { user: any };
    EditProfile: undefined;
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

function CustomTabBarButton({ onPress, active, colors }: any) {
    return (
        <TouchableOpacity
            style={styles.tabBarButtonContainer}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View
                style={[
                    styles.tabBarButton,
                    {
                        backgroundColor: active ? '#F1F5F9' : colors.primary,
                        transform: active ? [{ rotate: '45deg' }] : [],
                    },
                    active && styles.tabBarButtonActive
                ]}
            >
                <View style={active ? { transform: [{ rotate: '-45deg' }] } : {}}>
                    <Icon
                        name={active ? "close" : "add"}
                        size={active ? 28 : 32}
                        color={active ? '#0F172A' : "#FFFFFF"}
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
}

function MainTabs() {
    const { colors } = useThemeStore();
    const [createModalVisible, setCreateModalVisible] = React.useState(false);

    return (
        <>
            <Tab.Navigator
                screenOptions={{
                    tabBarStyle: {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                        borderTopWidth: 1,
                        paddingBottom: 8,
                        paddingTop: 8,
                        height: 65,
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textSecondary,
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: '600',
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
                        tabBarButton: () => (
                            <CustomTabBarButton
                                colors={colors}
                                active={createModalVisible}
                                onPress={() => setCreateModalVisible(!createModalVisible)}
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

            <CreateActionModal
                visible={createModalVisible}
                onClose={() => setCreateModalVisible(false)}
            />
        </>
    );
}

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function RootNavigator() {
    const { isAuthenticated } = useAuthStore();
    const { colors } = useThemeStore();

    return (
        <NavigationContainer ref={navigationRef}>
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
                            name="CreateOmzo"
                            component={CreateOmzoScreen}
                            options={{ title: 'Create Omzo', headerShown: false }}
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
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="OmzoViewer"
                            component={OmzoViewerScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="VoiceCall"
                            component={VoiceCallScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="VideoCall"
                            component={VideoCallScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="EditProfile"
                            component={EditProfileScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    tabBarButtonContainer: {
        top: -16,
        justifyContent: 'center',
        alignItems: 'center',
        width: 70,
    },
    tabBarButton: {
        width: 52,
        height: 52,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    tabBarButtonActive: {
        borderWidth: 0,
        backgroundColor: '#F1F5F9',
    },
});

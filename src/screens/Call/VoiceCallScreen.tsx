import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';

export default function VoiceCallScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user } = route.params as { user: any };

    const [isMuted, setIsMuted] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [callStatus, setCallStatus] = useState('Ringing...');
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Simulate picking up after 3 seconds
        const pickupTimeout = setTimeout(() => {
            setCallStatus('00:00');
            startTimer();
        }, 3000);

        return () => {
            clearTimeout(pickupTimeout);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setSeconds((prev) => prev + 1);
        }, 1000);
    };

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        navigation.goBack();
    };

    const statusText = callStatus === 'Ringing...' ? 'Ringing...' : formatTime(seconds);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <Icon name="close" size={24} color="#94a3b8" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>VOICE CALL</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.avatarWrapper}>
                    <View style={styles.avatarBorder}>
                        <Image
                            source={{ uri: user?.profile_picture_url || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                        />
                    </View>
                </View>

                <Text style={styles.userName}>{user?.full_name || user?.username || 'User'}</Text>
                <Text style={styles.statusText}>{statusText}</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[
                        styles.controlButton,
                        isMuted && { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' }
                    ]}
                    onPress={() => setIsMuted(!isMuted)}
                >
                    <Icon name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#FFFFFF" : "#1e293b"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.controlButton,
                        isSpeakerOn && { backgroundColor: '#4D96FF', borderColor: '#4D96FF' }
                    ]}
                    onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                    <Icon name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={isSpeakerOn ? "#FFFFFF" : "#1e293b"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, styles.endCallButton]}
                    onPress={handleEndCall}
                >
                    <Icon name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748B',
        letterSpacing: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -60,
    },
    avatarWrapper: {
        marginBottom: 30,
    },
    avatarBorder: {
        padding: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    avatar: {
        width: 140,
        height: 140,
        borderRadius: 20,
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 8,
    },
    statusText: {
        fontSize: 16,
        color: '#64748B',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 40,
    },
    controlButton: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    endCallButton: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
});

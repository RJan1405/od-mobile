import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    SafeAreaView,
    StatusBar,
    Alert,
    Platform,
    PermissionsAndroid,
} from 'react-native';
import { MediaStream } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import { API_CONFIG } from '@/config';
import websocket from '@/services/websocket';
import webrtc from '@/services/webrtc';
import api from '@/services/api';
import { buildFullUrl } from '@/utils/api-helpers';

export default function VoiceCallScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user, chatId, isIncoming } = route.params as { user: any, chatId: number, isIncoming?: boolean };

    const [isMuted, setIsMuted] = useState(false);
    const isCallingRef = useRef(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [callStatus, setCallStatus] = useState(isIncoming ? 'Incoming...' : 'Calling...');
    const [seconds, setSeconds] = useState(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAccepted, setIsAccepted] = useState(!isIncoming);
    const isAcceptedRef = useRef(!isIncoming);
    const incomingOfferRef = useRef<any>(null);
    const incomingIceCandidatesRef = useRef<any[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const processedSignalsRef = useRef<Set<string>>(new Set());
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        // Ensure chat WebSocket connected (Chat socket handles P2P signals)
        const cleanupChat = websocket.connectToChat(chatId, () => { });

        // FIX 3: Initialize signal sender immediately
        webrtc.setSignalSender(sendSignal);

        // Handle incoming P2P signals
        const cleanupP2P = websocket.onP2PSignal((data: any) => {
            console.log("🔥 RECEIVED SIGNAL P2P in VoiceCallScreen:", data.signal?.type);
            if (data && data.signal) {
                handleSignalingData(data.signal, data.sender_id);
            }
        });

        if (isAccepted) {
            setupCall();
        }

        return () => {
            webrtc.endCall();
            cleanupP2P();
            cleanupChat();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isAccepted]);

    const acceptCall = async () => {
        setIsAccepted(true);
        isAcceptedRef.current = true;
        setCallStatus('Connecting...');
        await setupCall();
    };

    const setupCall = async () => {
        if (isCallingRef.current) return;
        isCallingRef.current = true;
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                ]);

                if (
                    granted['android.permission.RECORD_AUDIO'] !== PermissionsAndroid.RESULTS.GRANTED
                ) {
                    setCallStatus('Permission Denied');
                    Alert.alert('Permission Denied', 'Microphone permission is required for voice calls.');
                    return;
                }
            }

            // 1. Setup Local Stream FIRST so tracks are ready before any signaling
            const stream = await webrtc.setupLocalStream(false);
            setLocalStream(stream);

            // 2. Setup Remote Stream Callback
            webrtc.setRemoteStreamCallback((remoteStream) => {
                console.log("[VoiceCall] Received remote stream");
                console.log("[VoiceCall] Remote Video Tracks:", remoteStream.getVideoTracks().length);
                console.log("[VoiceCall] Remote Audio Tracks:", remoteStream.getAudioTracks().length);
            });

            // Set Connection State Callback to start timer only when truly connected
            webrtc.setConnectionStateCallback((state) => {
                console.log("[VoiceCall] Connection State change received:", state);
                if (state === 'connected') {
                    setCallStatus('Connected');
                    startTimer();
                }
            });

            // 4. If not incoming, start the call
            if (!isIncoming) {
                await webrtc.startCall(false);
            } else {
                // Tell the caller we are ready to receive the offer and missing ICE candidates
                sendSignal({ type: 'webrtc.ready' });

                // If we already received an offer while ringing, process it
                if (incomingOfferRef.current) {
                    await webrtc.handleOffer(incomingOfferRef.current);
                    // Process cached ICE candidates
                    for (const ice of incomingIceCandidatesRef.current) {
                        await webrtc.handleIceCandidate(ice);
                    }
                    incomingIceCandidatesRef.current = []; // clear
                } else {
                    // Also check route params
                    const offer = (route.params as any)?.offer;
                    if (offer) {
                        await webrtc.handleOffer(offer);
                        // Process cached ICE candidates
                        for (const ice of incomingIceCandidatesRef.current) {
                            await webrtc.handleIceCandidate(ice);
                        }
                        incomingIceCandidatesRef.current = []; // clear
                    }
                }
            }
        } catch (error) {
            console.error('Call setup failed:', error);
            setCallStatus('Failed');
        }
    };

    const sendSignal = async (signalData: any) => {
        try {
            websocket.sendP2PSignal(chatId, signalData, user.id);
        } catch (error) {
            console.error('[VoiceCall] Failed to send signal:', error);
        }
    };

    // Polling removed as requested - using exclusively WebSockets for real-time signaling.
    // This prevents duplicate signals and race conditions.

    const handleSignalingData = async (data: any, fromUserId?: number) => {
        // Skip signals from self
        // Backend filters our own messages, but we log for tracking
        console.log('Call Signal Received:', data.type);
        switch (data.type) {
            case 'webrtc.ready':
                if (!isIncoming && !webrtc.isConnected) {
                    await webrtc.resendOffer(false);
                }
                break;
            case 'webrtc.offer':
                console.log('📞 Incoming offer received.');
                if (isIncoming && !isAcceptedRef.current) {
                    console.log('Ringing: caching Offer');
                    incomingOfferRef.current = data.sdp;
                } else {
                    await webrtc.handleOffer(data.sdp);
                }
                break;
            case 'webrtc.answer':
                console.log('📞 Received webrtc.answer. isAcceptedRef:', isAcceptedRef.current, 'isIncoming:', isIncoming);
                if (isAcceptedRef.current || !isIncoming) await webrtc.handleAnswer(data.sdp);
                break;
            case 'webrtc.ice':
                console.log('🧊 Received webrtc.ice');
                if (isIncoming && !isAcceptedRef.current) {
                    console.log('Incoming call ringing: caching ICE candidate');
                    incomingIceCandidatesRef.current.push(data.candidate);
                } else if (isAcceptedRef.current || !isIncoming) {
                    await webrtc.handleIceCandidate(data.candidate);
                }
                break;
            case 'call.end':
                console.log('Call ended by peer.');
                handleEndCall();
                break;
        }
    };

    const startTimer = () => {
        if (timerRef.current) return;
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
        // Prevent recursive ending
        if (callStatus === 'Ended') return;
        setCallStatus('Ended');

        // Send a signal to the other user that the call has ended
        sendSignal({ type: 'call.end' });
        webrtc.endCall();
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            (navigation as any).reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        }
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = isMuted;
            });
            setIsMuted(!isMuted);
        }
    };

    const statusText = callStatus === 'Connected' ? formatTime(seconds) : callStatus;

    // INCOMING CALL UI
    if (!isAccepted) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar barStyle="light-content" />
                <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', marginTop: 100 }}>
                    <Image
                        source={{ uri: buildFullUrl(user?.profile_picture_url || user?.avatar) || 'https://via.placeholder.com/150' }}
                        style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 20, borderWidth: 3, borderColor: '#fff' }}
                    />
                    <Text style={{ color: '#FFF', fontSize: 28, fontWeight: 'bold' }}>{user?.full_name || user?.username || 'User'}</Text>
                    <Text style={{ color: '#aaa', fontSize: 18, marginTop: 10 }}>Incoming Voice Call...</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingBottom: 60, paddingHorizontal: 40 }}>
                    <TouchableOpacity onPress={handleEndCall} style={[styles.controlButton, { backgroundColor: '#ef4444', width: 75, height: 75, borderRadius: 37.5 }]}>
                        <Icon name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={acceptCall} style={[styles.controlButton, { backgroundColor: '#22c55e', width: 75, height: 75, borderRadius: 37.5 }]}>
                        <Icon name="call" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <TouchableOpacity onPress={handleEndCall} style={styles.closeButton}>
                    <Icon name="close" size={24} color="#94a3b8" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>VOICE CALL</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.avatarWrapper}>
                    <View style={styles.avatarBorder}>
                        <Image
                            source={{ uri: buildFullUrl(user?.profile_picture_url || user?.avatar) || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                        />
                    </View>
                </View>

                <Text style={styles.userName}>{user?.full_name || user?.username || 'User'}</Text>
                <Text style={styles.statusText}>{statusText}</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                    onPress={toggleMute}
                >
                    <Icon name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#FFF" : "#1e293b"} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                    onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                    <Icon name={isSpeakerOn ? "volume-high" : "volume-medium"} size={28} color={isSpeakerOn ? "#FFF" : "#1e293b"} />
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
    controlButtonActive: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    endCallButton: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
});

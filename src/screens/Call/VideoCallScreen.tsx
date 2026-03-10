import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Platform,
    Dimensions,
    Image,
} from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useThemeStore } from '@/stores/themeStore';
import websocket from '@/services/websocket';
import webrtc from '@/services/webrtc';
import api from '@/services/api';

const { width, height } = Dimensions.get('window');

export default function VideoCallScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { colors } = useThemeStore();
    const { user, chatId, isIncoming } = route.params as { user: any, chatId: number, isIncoming?: boolean };

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [callStatus, setCallStatus] = useState(isIncoming ? 'Incoming...' : 'Calling...');
    const [seconds, setSeconds] = useState(0);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isAccepted, setIsAccepted] = useState(!isIncoming);
    const incomingOfferRef = useRef<any>(null);
    const incomingIceCandidatesRef = useRef<any[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const processedSignalsRef = useRef<Set<string>>(new Set());
    const startTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        // ALWAYS connect signaling to listen for call.end or early offers
        websocket.connectToCall(chatId, (data) => {
            handleSignalingData(data);
        });
        startPolling();

        if (isAccepted) {
            setupCall();
        }

        return () => {
            webrtc.endCall();
            websocket.disconnectFromCall();
            if (timerRef.current) clearInterval(timerRef.current);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, []);

    const acceptCall = async () => {
        setIsAccepted(true);
        setCallStatus('Connecting...');
        await setupCall();
    };

    const setupCall = async () => {
        try {
            // 1. Setup Local Stream FIRST so tracks are ready before any signaling
            const stream = await webrtc.setupLocalStream(true);
            setLocalStream(stream);

            // 2. Set signal sender for WebRTC service
            webrtc.setSignalSender(sendSignal);

            // 3. Setup Remote Stream Callback
            webrtc.setRemoteStreamCallback((remote) => {
                setRemoteStream(remote);
                setCallStatus('Connected');
                startTimer();
            });

            // 4. If not incoming, start the call
            if (!isIncoming) {
                await webrtc.startCall(true);
            } else {
                // If we already received an offer while ringing, process it
                if (incomingOfferRef.current) {
                    await webrtc.handleOffer(incomingOfferRef.current);
                    // Process cached ICE candidates
                    for (const ice of incomingIceCandidatesRef.current) {
                        await webrtc.handleIceCandidate(ice);
                    }
                    incomingIceCandidatesRef.current = []; // clear
                } else {
                    // Tell the caller we are ready to receive the offer
                    sendSignal({ type: 'webrtc.ready' });
                    // Also check route params
                    const offer = (route.params as any)?.offer;
                    if (offer) {
                        await webrtc.handleOffer(offer);
                    }
                }
            }
        } catch (error) {
            console.error('Call setup failed:', error);
            setCallStatus('Failed');
        }
    };

    const sendSignal = async (signalData: any) => {
        // Try WebSocket first
        websocket.sendCallSignal(signalData);

        // Fallback or concurrent: send via API for reliability
        // We only send significant signals via API to avoid bloat
        if (['webrtc.offer', 'webrtc.answer', 'webrtc.ice', 'call.end'].includes(signalData.type)) {
            try {
                await api.sendP2PSignal(chatId, user.id, signalData);
            } catch (error) {
                console.warn('Fallback signaling failed:', error);
            }
        }
    };

    const startPolling = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await api.getP2PSignals(chatId);
                if (response.success && Array.isArray(response.data)) {
                    response.data.forEach((signalObj: any) => {
                        // 1. Skip if already processed
                        const signalId = `${signalObj.id}_${signalObj.timestamp}`;
                        if (processedSignalsRef.current.has(signalId)) return;

                        // 2. Skip if stale (older than call start - 10s buffer)
                        const signalTime = new Date(signalObj.timestamp).getTime();
                        if (signalTime < (startTimeRef.current - 10000)) return;

                        // 3. Mark as processed
                        processedSignalsRef.current.add(signalId);

                        // 4. Handle signaling data (handle both field names)
                        handleSignalingData(signalObj.signal_data || signalObj.signal, signalObj.sender_id);
                    });
                }
            } catch (error) {
                console.error('Polling for signals failed:', error);
            }
        }, 3000); // Poll every 3 seconds
    };

    const handleSignalingData = async (data: any, fromUserId?: number) => {
        // Skip signals from self
        if (fromUserId && fromUserId === (api as any).currentUserId) {
            return;
        }

        console.log('Call Signal Received:', data.type);
        switch (data.type) {
            case 'webrtc.ready':
                if (!isIncoming) {
                    await webrtc.resendOffer(true);
                }
                break;
            case 'webrtc.offer':
                if (isIncoming && !isAccepted) {
                    console.log('Incoming call ringing: caching offer');
                    incomingOfferRef.current = data.sdp;
                } else if (isIncoming && isAccepted) {
                    await webrtc.handleOffer(data.sdp);
                }
                break;
            case 'webrtc.answer':
                if (isAccepted || !isIncoming) await webrtc.handleAnswer(data.sdp);
                break;
            case 'webrtc.ice':
                if (isIncoming && !isAccepted) {
                    console.log('Incoming call ringing: caching ICE candidate');
                    incomingIceCandidatesRef.current.push(data.candidate);
                } else if (isAccepted || !isIncoming) {
                    await webrtc.handleIceCandidate(data.candidate);
                }
                break;
            case 'call.end':
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

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = isVideoOff;
            });
            setIsVideoOff(!isVideoOff);
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
                        source={{ uri: user?.profile_picture_url || user?.avatar || 'https://via.placeholder.com/150' }}
                        style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 20, borderWidth: 3, borderColor: '#fff' }}
                    />
                    <Text style={{ color: '#FFF', fontSize: 28, fontWeight: 'bold' }}>{user?.full_name || user?.username || 'User'}</Text>
                    <Text style={{ color: '#aaa', fontSize: 18, marginTop: 10 }}>Incoming Video Call...</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingBottom: 60, paddingHorizontal: 40 }}>
                    <TouchableOpacity onPress={handleEndCall} style={[styles.controlButton, { backgroundColor: '#ef4444', width: 75, height: 75, borderRadius: 37.5 }]}>
                        <Icon name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={acceptCall} style={[styles.controlButton, { backgroundColor: '#22c55e', width: 75, height: 75, borderRadius: 37.5 }]}>
                        <Icon name="videocam" size={32} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
            <StatusBar barStyle="light-content" />

            {/* Remote Video (Full Screen) */}
            {remoteStream ? (
                <RTCView
                    streamURL={remoteStream.toURL()}
                    style={styles.remoteVideo}
                    objectFit="cover"
                />
            ) : (
                <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>{callStatus}</Text>
                </View>
            )}

            {/* Local Video (Small Overlay) */}
            {localStream && !isVideoOff && (
                <View style={styles.localVideoWrapper}>
                    <RTCView
                        streamURL={localStream.toURL()}
                        style={styles.localVideo}
                        objectFit="cover"
                    />
                </View>
            )}

            <View style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleEndCall} style={styles.closeButton}>
                        <Icon name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.userName}>{user?.full_name || user?.username || 'User'}</Text>
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                        onPress={toggleMute}
                    >
                        <Icon name={isMuted ? "mic-off" : "mic"} size={26} color={isMuted ? "#FFF" : "#FFF"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
                        onPress={toggleVideo}
                    >
                        <Icon name={isVideoOff ? "videocam-off" : "videocam"} size={26} color={isVideoOff ? "#FFF" : "#FFF"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                        onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                    >
                        <Icon name={isSpeakerOn ? "volume-high" : "volume-medium"} size={26} color="#FFF" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, styles.endCallButton]}
                        onPress={handleEndCall}
                    >
                        <Icon name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    remoteVideo: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#1e293b',
    },
    localVideoWrapper: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 120,
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FFF',
        zIndex: 10,
    },
    localVideo: {
        flex: 1,
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e293b',
    },
    placeholderText: {
        color: '#94a3b8',
        fontSize: 18,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        paddingVertical: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginTop: 10,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
    },
    statusText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    controlButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonActive: {
        backgroundColor: '#EF4444',
    },
    endCallButton: {
        backgroundColor: '#EF4444',
    },
});

import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices,
    MediaStream,
} from 'react-native-webrtc';
import websocket from './websocket';

class WebRTCService {
    private peerConnection: any = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private iceCandidatesQueue: any[] = [];
    private localIceCandidates: any[] = [];
    private hasProcessedOffer = false;
    public isConnected = false;
    private configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            {
                urls: [
                    'turn:openrelay.metered.ca:80',
                    'turn:openrelay.metered.ca:443',
                    'turn:openrelay.metered.ca:443?transport=tcp'
                ],
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ],
    };

    private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
    private onCallEndCallback: (() => void) | null = null;
    private onConnectionStateCallback: ((state: string) => void) | null = null;
    private signalSender: ((signal: any) => void) | null = null;

    async setupLocalStream(isVideo: boolean) {
        try {
            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: isVideo ? {
                    facingMode: 'user',
                    width: 640,
                    height: 480,
                    frameRate: 30,
                } : false,
            }) as MediaStream;
            this.localStream = stream;

            // If peerConnection already exists (e.g. signaling started), add tracks now
            if (this.peerConnection) {
                this.addStreamTracks(stream);
            }

            return stream;
        } catch (error) {
            console.error('Error setting up local stream:', error);
            throw error;
        }
    }

    createPeerConnection() {
        if (this.peerConnection) return; // 🔥 prevent duplicate

        this.peerConnection = new RTCPeerConnection(this.configuration);

        this.peerConnection.onicecandidate = (event: any) => {
            if (event.candidate && this.signalSender) {
                console.log('[WebRTC] Generated ICE candidate');
                this.localIceCandidates.push(event.candidate);
                this.signalSender({
                    type: 'webrtc.ice',
                    candidate: event.candidate,
                });
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            if (this.peerConnection) {
                console.log('[WebRTC] ICE Gathering State:', this.peerConnection.iceGatheringState);
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            if (this.peerConnection) {
                console.log('[WebRTC] ICE Connection State:', this.peerConnection.iceConnectionState);
                const state = this.peerConnection.iceConnectionState;
                if (state === 'connected' || state === 'completed') {
                    this.isConnected = true;
                    console.log('[WebRTC] Connection established successfully!');
                    if (this.onConnectionStateCallback) {
                        this.onConnectionStateCallback('connected');
                    }
                }
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection) {
                console.log('[WebRTC] Peer Connection State:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    this.isConnected = true;
                    if (this.onConnectionStateCallback) {
                        this.onConnectionStateCallback('connected');
                    }
                }
            }
        };

        this.peerConnection.ontrack = (event: any) => {
            console.log('[WebRTC] Received remote track of kind:', event.track.kind);

            if (!this.remoteStream) {
                this.remoteStream = event.streams[0] || new MediaStream();
            }

            // Avoid duplicate adding
            const alreadyExists = this.remoteStream
                .getTracks()
                .some((t: any) => t.id === event.track.id);

            if (!alreadyExists) {
                this.remoteStream.addTrack(event.track);
            }

            // 🔥 Call callback ONLY ONCE (important)
            const isVideoCall = this.localStream && this.localStream.getVideoTracks().length > 0;
            const requiredTracks = isVideoCall ? 2 : 1;

            if (this.onRemoteStreamCallback && this.remoteStream.getTracks().length >= requiredTracks) {
                console.log('[WebRTC] Final remote stream ready');
                this.onRemoteStreamCallback(this.remoteStream);
            }
        };

        if (this.localStream) {
            this.addStreamTracks(this.localStream);
        }

        return this.peerConnection;
    }

    private addStreamTracks(stream: MediaStream) {
        if (!this.peerConnection) return;

        console.log('[WebRTC] Adding local tracks to connection. Total tracks:', stream.getTracks().length);
        if (this.peerConnection.addTrack) {
            stream.getTracks().forEach((track) => {
                console.log(`[WebRTC] Adding local ${track.kind} track to peerConnection.`);
                // Check if track already added to avoid duplicates
                const alreadyAdded = this.peerConnection.getSenders().some((s: any) => s.track === track);
                if (!alreadyAdded) {
                    this.peerConnection.addTrack(track, stream);
                }
            });
        } else {
            this.peerConnection.addStream(stream);
        }
    }

    async startCall(isVideo: boolean) {
        console.log(`[WebRTC] Starting ${isVideo ? 'video' : 'voice'} call...`);
        this.createPeerConnection();
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        console.log('[WebRTC] Sending offer...');
        if (this.signalSender) {
            this.signalSender({
                type: 'webrtc.offer',
                sdp: offer, // Full RTCSessionDescriptionInit object
                audioOnly: !isVideo,
            });
        }
    }

    // Helper to request a new offer from the other side or re-send current one
    async resendOffer(isVideo: boolean) {
        if (this.peerConnection && this.peerConnection.localDescription) {
            console.log('[WebRTC] Re-sending existing local offer...');
            if (this.signalSender) {
                this.signalSender({
                    type: 'webrtc.offer',
                    sdp: this.peerConnection.localDescription,
                    audioOnly: !isVideo,
                });

                // Re-send all local ICE candidates gathered so far
                console.log(`[WebRTC] Re-sending ${this.localIceCandidates.length} local ICE candidates`);
                this.localIceCandidates.forEach(candidate => {
                    this.signalSender!({
                        type: 'webrtc.ice',
                        candidate: candidate,
                    });
                });
            }
        }
    }

    async handleOffer(sdp: any) {
        if (this.hasProcessedOffer) {
            console.log('[WebRTC] Offer already processed, skipping duplicate');
            return;
        }

        try {
            console.log('[WebRTC] Handling offer...');
            this.createPeerConnection();
            this.hasProcessedOffer = true;

            // Check if sdp is a string (legacy/mobile direct) or object (web/new)
            const remoteSdp = typeof sdp === 'string' ? { type: 'offer', sdp } : sdp;

            console.log('[WebRTC] Setting remote description...');
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(remoteSdp as any)
            );

            console.log('[WebRTC] Creating answer...');
            const answer = await this.peerConnection.createAnswer();
            console.log('[WebRTC] Setting local description (answer)...');
            await this.peerConnection.setLocalDescription(answer);

            // Process queued ice candidates AFTER both descriptions are set
            await this.processQueuedCandidates();

            if (this.signalSender) {
                console.log('[WebRTC] Sending answer signal');
                this.signalSender({
                    type: 'webrtc.answer',
                    sdp: answer,
                });
            } else {
                console.warn('[WebRTC] Cannot send answer: signalSender is null');
            }
        } catch (error) {
            console.error('[WebRTC] Error in handleOffer:', error);
            // Reset processed flag so it can be retried if possible
            this.hasProcessedOffer = false;
        }
    }

    async handleAnswer(sdp: any) {
        try {
            console.log('[WebRTC] Handling answer...');
            if (this.peerConnection) {
                console.log('[WebRTC] Current signalingState:', this.peerConnection.signalingState);
                if (this.peerConnection.signalingState !== 'have-local-offer') {
                    console.log('⚠️ [WebRTC] Warning: Skipping Answer because signaling state is', this.peerConnection.signalingState);
                    return;
                }
                const remoteSdp = typeof sdp === 'string' ? { type: 'answer', sdp } : sdp;
                console.log('[WebRTC] Setting remote description (answer)...');
                await this.peerConnection.setRemoteDescription(
                    new RTCSessionDescription(remoteSdp as any)
                );

                // Process queued ice candidates after remote is set and we're stable
                await this.processQueuedCandidates();
            } else {
                console.warn('[WebRTC] handleAnswer called but peerConnection is null');
            }
        } catch (error) {
            console.error('[WebRTC] Error in handleAnswer:', error);
        }
    }

    async handleIceCandidate(candidate: any) {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ice candidate', e);
            }
        } else {
            console.log('[WebRTC] Queuing ICE candidate (remoteDescription not set)');
            this.iceCandidatesQueue.push(candidate);
        }
    }

    private async processQueuedCandidates() {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
            console.log(`[WebRTC] Processing ${this.iceCandidatesQueue.length} queued ICE candidates`);
            while (this.iceCandidatesQueue.length > 0) {
                const candidate = this.iceCandidatesQueue.shift();
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error('[WebRTC] Error adding queued ice candidate', e);
                }
            }
        }
    }

    setRemoteStreamCallback(callback: (stream: MediaStream) => void) {
        this.onRemoteStreamCallback = callback;
        if (this.remoteStream) {
            callback(this.remoteStream);
        }
    }

    setCallEndCallback(callback: () => void) {
        this.onCallEndCallback = callback;
    }

    setConnectionStateCallback(callback: (state: string) => void) {
        this.onConnectionStateCallback = callback;
    }

    setSignalSender(callback: (signal: any) => void) {
        this.signalSender = callback;
    }

    endCall() {
        if (!this.peerConnection && !this.localStream) return;

        // Forcefully close, no early return as users expect "End Call" to actually end it
        console.log("Forcing call end ❌");

        if (this.onCallEndCallback) {
            this.onCallEndCallback();
        }

        if (this.signalSender) {
            this.signalSender({ type: 'call.end' });
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach((track: any) => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.remoteStream = null;
        this.iceCandidatesQueue = [];
        this.localIceCandidates = [];
        this.hasProcessedOffer = false;
        this.isConnected = false;
    }

    getLocalStream() {
        return this.localStream;
    }

    getRemoteStream() {
        return this.remoteStream;
    }
}

export default new WebRTCService();

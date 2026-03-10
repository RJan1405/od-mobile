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
    private hasProcessedOffer = false;
    private configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ],
    };

    private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
    private onCallEndCallback: (() => void) | null = null;
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
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.peerConnection = new RTCPeerConnection(this.configuration);

        this.peerConnection.onicecandidate = (event: any) => {
            if (event.candidate && this.signalSender) {
                console.log('[WebRTC] Generated ICE candidate');
                this.signalSender({
                    type: 'webrtc.ice',
                    candidate: event.candidate,
                });
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            if (this.peerConnection) {
                console.log('[WebRTC] ICE Connection State:', this.peerConnection.iceConnectionState);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection) {
                console.log('[WebRTC] Peer Connection State:', this.peerConnection.connectionState);
            }
        };

        this.peerConnection.ontrack = (event: any) => {
            console.log('[WebRTC] Received remote track:', event.track.kind);
            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
            } else {
                // Fallback for cases where streams are not provided
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                }
                this.remoteStream.addTrack(event.track);
            }

            if (this.onRemoteStreamCallback && this.remoteStream) {
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

        console.log('[WebRTC] Adding local tracks to connection');
        if (this.peerConnection.addTrack) {
            stream.getTracks().forEach((track) => {
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
            }
        }
    }

    async handleOffer(sdp: any) {
        if (this.hasProcessedOffer) {
            console.log('[WebRTC] Offer already processed, skipping duplicate');
            return;
        }

        console.log('[WebRTC] Handling offer...');
        this.createPeerConnection();
        this.hasProcessedOffer = true;

        // Check if sdp is a string (legacy/mobile direct) or object (web/new)
        const remoteSdp = typeof sdp === 'string' ? { type: 'offer', sdp } : sdp;

        await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(remoteSdp as any)
        );

        // Process queued ice candidates
        this.processQueuedCandidates();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        if (this.signalSender) {
            this.signalSender({
                type: 'webrtc.answer',
                sdp: answer,
            });
        }
    }

    async handleAnswer(sdp: any) {
        console.log('[WebRTC] Handling answer...');
        if (this.peerConnection) {
            if (this.peerConnection.signalingState !== 'have-local-offer') {
                console.log('[WebRTC] Skipping Answer because signaling state is', this.peerConnection.signalingState);
                return;
            }
            const remoteSdp = typeof sdp === 'string' ? { type: 'answer', sdp } : sdp;
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(remoteSdp as any)
            );

            // Process queued ice candidates
            this.processQueuedCandidates();
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

    setSignalSender(callback: (signal: any) => void) {
        this.signalSender = callback;
    }

    endCall() {
        if (this.onCallEndCallback) {
            this.onCallEndCallback();
        }

        if (this.signalSender) {
            this.signalSender({ type: 'call.end' });
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.remoteStream = null;
        this.iceCandidatesQueue = [];
        this.hasProcessedOffer = false;
    }

    getLocalStream() {
        return this.localStream;
    }

    getRemoteStream() {
        return this.remoteStream;
    }
}

export default new WebRTCService();

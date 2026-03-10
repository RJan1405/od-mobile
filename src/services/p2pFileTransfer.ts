/**
 * P2P File Transfer Service for Odnix Mobile
 * Uses react-native-webrtc DataChannels + real-time WebSocket signaling
 */

import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const CHUNK_SIZE = 16384; // 16 KB

export type P2PStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'transferring'
    | 'completed'
    | 'failed';

export interface FileTransferCallbacks {
    onStatusChange: (status: P2PStatus) => void;
    onProgress: (percent: number) => void;
    onMetadataReceived?: (name: string, size: number) => void;
    onReceived: (name: string, blob: Blob, mimeType: string) => void;
    onError: (msg: string) => void;
}

interface FileMetadata {
    name: string;
    size: number;
    type: string;
}

export class P2PFileTransferService {
    private pc: any = null;
    private dataChannel: any = null;
    private chatId: number;
    private targetUserId: number;
    private callbacks: FileTransferCallbacks;
    private sendSignal: (signal: any) => void;

    // Receive-side buffer
    private incomingMeta: FileMetadata | null = null;
    private receivedChunks: ArrayBuffer[] = [];
    private receivedBytes = 0;

    // Signal Queue (for handling ICE candidates that arrive before acceptance)
    private signalQueue: any[] = [];

    constructor(
        chatId: number,
        targetUserId: number,
        callbacks: FileTransferCallbacks,
        sendSignal: (signal: any) => void
    ) {
        this.chatId = chatId;
        this.targetUserId = targetUserId;
        this.callbacks = callbacks;
        this.sendSignal = sendSignal;
        console.log(`[P2P] initialized for chat ${chatId}, target ${targetUserId}`);
    }

    /**
     * Handle an incoming WebRTC signal received via WebSocket
     */
    async handleSignal(signal: any): Promise<void> {
        if (!this.pc) {
            console.log(`[P2P] Queuing signal ${signal.type} (PC not ready)`);
            this.signalQueue.push(signal);
            return;
        }

        console.log('[P2P] Received signal:', signal.type);

        try {
            if (signal.type === 'file.answer' || signal.type === 'webrtc.answer') {
                console.log('[P2P] Setting remote description (answer)');
                await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            } else if (signal.type === 'file.ice' || signal.type === 'webrtc.ice') {
                if (signal.candidate) {
                    const c = signal.candidate;
                    console.log(`[P2P] Adding remote ICE candidate: ${c.candidate?.substring(0, 30)}...`);
                    await this.pc.addIceCandidate(new RTCIceCandidate(c)).catch((e: any) => {
                        console.warn('[P2P] Error adding ICE candidate:', e.message);
                    });
                }
            } else if (signal.type === 'file.offer' || signal.type === 'webrtc.offer') {
                console.log('[P2P] Setting remote description (offer)');
                await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);

                const responseType = (signal.type === 'webrtc.offer') ? 'webrtc.answer' : 'file.answer';
                console.log(`[P2P] Sending ${responseType}`);
                this.sendSignal({
                    type: responseType,
                    sdp: answer,
                });
            }
        } catch (err: any) {
            console.error('[P2P] Error in handleSignal:', err.message);
        }
    }

    // ─────────────────────────────────────────────
    // SEND side: caller/initiator
    // ─────────────────────────────────────────────
    async sendFile(fileUri: string, fileName: string, fileSize: number, mimeType: string): Promise<void> {
        this.cleanup();
        this.callbacks.onStatusChange('connecting');

        console.log('[P2P] Starting sendFile flow for:', fileName);
        this.pc = this._createPC();
        this._flushSignalQueue();

        // Create Data Channel (sender side) - IMPORTANT: Must be done BEFORE createOffer
        console.log('[P2P] Creating data channel');
        const dc = this.pc.createDataChannel('file-transfer');
        this._setupDataChannel(dc);

        // Create Offer
        console.log('[P2P] Creating offer');
        const offer = await this.pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
        });
        await this.pc.setLocalDescription(offer);

        console.log('[P2P] Sending offer. SDP starts with:', offer.sdp?.substring(0, 50));
        this.sendSignal({
            type: 'webrtc.offer',
            sdp: offer,
            meta: { name: fileName, size: fileSize, mimeType },
        });

        // Once data channel opens, send file
        dc.onopen = async () => {
            console.log('[P2P] Data channel opened! Starting transfer');
            this.callbacks.onStatusChange('transferring');

            // Send metadata first (standardize with web)
            dc.send(JSON.stringify({
                type: 'file-start',
                metadata: { name: fileName, size: fileSize, type: mimeType }
            }));

            // Read file in chunks
            const response = await fetch(fileUri);
            const arrayBuffer = await response.arrayBuffer();
            const total = arrayBuffer.byteLength;
            let offset = 0;

            const sendNextChunk = () => {
                if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
                    console.warn('[P2P] Data channel closed during transfer');
                    this.callbacks.onError('Data channel closed unexpectedly');
                    return;
                }

                // Backpressure
                if (dc.bufferedAmount > 8 * 1024 * 1024) {
                    setTimeout(sendNextChunk, 20);
                    return;
                }

                const end = Math.min(offset + CHUNK_SIZE, total);
                const chunk = arrayBuffer.slice(offset, end);
                dc.send(chunk);
                offset = end;
                this.callbacks.onProgress(Math.round((offset / total) * 100));

                if (offset < total) {
                    setTimeout(sendNextChunk, 0);
                } else {
                    console.log('[P2P] Chunks all sent. Sending file-end.');
                    dc.send(JSON.stringify({ type: 'file-end' }));
                    this.callbacks.onStatusChange('completed');
                    setTimeout(() => this.cleanup(), 3000);
                }
            };
            sendNextChunk();
        };
    }

    // ─────────────────────────────────────────────
    // RECEIVE side: answerer
    // ─────────────────────────────────────────────
    async acceptIncomingOffer(signal: any): Promise<void> {
        this.cleanup();
        this.callbacks.onStatusChange('connecting');

        console.log('[P2P] Accepting incoming offer');
        this.pc = this._createPC();
        this._flushSignalQueue();

        // Listen for remote data channel
        this.pc.ondatachannel = (event: any) => {
            console.log('[P2P] Received remote data channel');
            this._setupDataChannel(event.channel);
            event.channel.onopen = () => {
                console.log('[P2P] Remote data channel opened');
                this.callbacks.onStatusChange('connected');
            };
        };

        console.log('[P2P] Setting remote description (offer-accept)');
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        const responseType = (signal.type === 'webrtc.offer') ? 'webrtc.answer' : 'file.answer';
        console.log(`[P2P] Sending ${responseType}`);
        this.sendSignal({
            type: responseType,
            sdp: answer,
        });
    }

    // ─────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────
    private _createPC(): any {
        const pc = new RTCPeerConnection({
            iceServers: ICE_SERVERS,
            bundlePolicy: 'balanced',
            iceCandidatePoolSize: 10,
        } as any) as any;

        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                const c = event.candidate;
                console.log(`[P2P] Generated ICE: ${c.candidate.substring(0, 30)}... type: ${c.type || 'unknown'}`);
                this.sendSignal({
                    type: 'webrtc.ice',
                    candidate: {
                        candidate: c.candidate,
                        sdpMid: c.sdpMid,
                        sdpMLineIndex: c.sdpMLineIndex,
                    },
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('[P2P] ICE Connection State:', pc.iceConnectionState);
        };

        pc.onconnectionstatechange = () => {
            const state = (pc as any)?.connectionState;
            console.log('[P2P] Connection state changed:', state);
            if (state === 'failed') {
                console.error('[P2P] Connection failed. Check if both devices are on the same network or if a firewall is blocking UDP.');
                this.callbacks.onError('P2P connection failed');
                this.callbacks.onStatusChange('failed');
                // Don't cleanup immediately so user can see error
            } else if (state === 'disconnected') {
                console.warn('[P2P] Connection disconnected');
            }
        };

        return pc;
    }

    private _flushSignalQueue() {
        if (this.signalQueue.length > 0) {
            console.log(`[P2P] Flushing ${this.signalQueue.length} queued signals`);
            const signals = [...this.signalQueue];
            this.signalQueue = [];
            signals.forEach(sig => this.handleSignal(sig));
        }
    }

    private _setupDataChannel(dc: any) {
        console.log('[P2P] Setting up data channel listeners');
        this.dataChannel = dc;

        dc.onmessage = (event: MessageEvent) => {
            const data = event.data;

            if (typeof data === 'string') {
                try {
                    const msg = JSON.parse(data);
                    console.log('[P2P] DataChannel message:', msg.type);

                    // Support both mobile (meta) and web (file-start)
                    if (msg.type === 'meta' || msg.type === 'file-start') {
                        const meta = msg.metadata || {
                            name: msg.name,
                            size: msg.size,
                            type: msg.mimeType || msg.type
                        };
                        this.incomingMeta = {
                            name: meta.name,
                            size: meta.size,
                            type: meta.type
                        };
                        this.receivedChunks = [];
                        this.receivedBytes = 0;
                        if (this.callbacks.onMetadataReceived) {
                            this.callbacks.onMetadataReceived(meta.name, meta.size);
                        }
                        this.callbacks.onStatusChange('transferring');
                    } else if (msg.type === 'done' || msg.type === 'file-end') {
                        if (this.incomingMeta) {
                            console.log('[P2P] File received complete. Reassembling...');
                            const blobParts = this.receivedChunks.map(buf => new Uint8Array(buf));
                            const blob = new Blob(blobParts as any, { type: this.incomingMeta.type } as any);
                            this.callbacks.onReceived(this.incomingMeta.name, blob, this.incomingMeta.type);
                            this.callbacks.onStatusChange('completed');
                            setTimeout(() => this.cleanup(), 3000);
                        }
                    }
                } catch (e: any) {
                    console.warn('[P2P] Error parsing DataChannel string message:', e.message);
                }
            } else if (data instanceof ArrayBuffer) {
                this.receivedChunks.push(data);
                this.receivedBytes += data.byteLength;
                if (this.incomingMeta) {
                    this.callbacks.onProgress(
                        Math.round((this.receivedBytes / this.incomingMeta.size) * 100)
                    );
                }
            }
        };

        dc.onerror = (e: any) => {
            console.error('[P2P] Data channel error:', e.message);
            this.callbacks.onError('Data channel error');
            this.callbacks.onStatusChange('failed');
        };
    }

    cleanup() {
        console.log('[P2P] Cleaning up session');
        if (this.dataChannel) {
            try { this.dataChannel.close(); } catch { }
            this.dataChannel = null;
        }
        if (this.pc) {
            try { this.pc.close(); } catch { }
            this.pc = null;
        }
        this.incomingMeta = null;
        this.receivedChunks = [];
        this.receivedBytes = 0;
    }
}

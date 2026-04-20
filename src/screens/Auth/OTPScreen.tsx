import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function OTPScreen() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(60);
    const inputs = useRef<Array<TextInput | null>>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const { verifyPhoneOtp, verifyEmailOtp, registerAndSendEmailOtp, isLoading, error } = useAuthStore();
    const { colors } = useThemeStore();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const { userId, phoneNumber, email, registrationData, isEmail, isFirebase } = route.params || {};

    // Start the resend countdown
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setResendTimer(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current!);
    }, []);

    const handleResend = async () => {
        if (resendTimer > 0) return;
        setOtp(['', '', '', '', '', '']);
        let success = false;
        if ((isEmail || isFirebase) && registrationData) {
            success = await registerAndSendEmailOtp(registrationData);
        } else if (phoneNumber) {
            // handle SMS resend if applicable in the future
        }

        if (success) {
            setResendTimer(60);
            timerRef.current = setInterval(() => {
                setResendTimer(t => {
                    if (t <= 1) { clearInterval(timerRef.current!); return 0; }
                    return t - 1;
                });
            }, 1000);
        }
    };

    const handleOtpChange = (value: string, index: number) => {
        // Handle paste of full OTP (e.g. from SMS notification)
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newOtp = [...otp];
            digits.forEach((d, i) => {
                if (i < 6) newOtp[i] = d;
            });
            setOtp(newOtp);
            // Focus the last filled input
            const lastIndex = Math.min(digits.length - 1, 5);
            inputs.current[lastIndex]?.focus();
            // Auto-submit if full code pasted
            if (digits.length === 6) {
                setTimeout(() => handleVerify(digits.join('')), 100);
            }
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Move to next input if value is entered
        if (value && index < 5) {
            inputs.current[index + 1]?.focus();
        }

        // Auto-submit when last digit filled
        if (value && index === 5) {
            if (newOtp.every(d => d !== '')) {
                setTimeout(() => handleVerify(newOtp.join('')), 100);
            }
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        // Move to previous input on backspace if current is empty
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpString?: string) => {
        const code = otpString ?? otp.join('');
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            Alert.alert('Error', 'Please enter a valid 6-digit code');
            return;
        }

        let success = false;
        if (isEmail || isFirebase) {
            success = await verifyEmailOtp(code, email);
        } else {
            success = await verifyPhoneOtp(code, userId, phoneNumber);
        }

        if (!success && error) {
            Alert.alert('Verification Failed', typeof error === 'string' ? error : 'Invalid code');
        }
        // Success handled by authStore updating isAuthenticated
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.logoContainer}>
                    <Image 
                        source={require('@/assets/logo.png')} 
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>

                <Text style={[styles.title, { color: colors.text }]}>
                    {isEmail ? 'Verify Email' : 'Verify Phone'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    We've sent a 6-digit code to{'\n'}
                    <Text style={{ fontWeight: 'bold', color: colors.text }}>{email || phoneNumber || 'your registered account'}</Text>
                </Text>

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputs.current[index] = ref)}
                            style={[
                                styles.otpInput,
                                {
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    borderColor: otp[index] ? colors.primary : colors.border,
                                },
                            ]}
                            value={digit}
                            onChangeText={(value) => handleOtpChange(value, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    onPress={handleVerify}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    style={{ width: '100%' }}
                >
                    <View style={[styles.button, { backgroundColor: colors.primary }]}>
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.buttonText}>Verify & Continue</Text>
                        )}
                    </View>
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                    <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                        Didn't receive the code?{'  '}
                    </Text>
                    <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || isLoading}>
                        <Text style={[styles.resendLink, { color: resendTimer > 0 ? colors.textSecondary : colors.primary }]}>
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 20,
        left: 0,
        padding: 8,
    },
    logoImage: {
        width: 80,
        height: 80,
        borderRadius: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 40,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderRadius: 12,
        borderWidth: 2,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
    },
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resendContainer: {
        flexDirection: 'row',
        marginTop: 32,
    },
    resendText: {
        fontSize: 14,
    },
    resendLink: {
        fontSize: 14,
        fontWeight: 'bold',
    },
});

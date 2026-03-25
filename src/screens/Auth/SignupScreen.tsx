import React, { useState } from 'react';
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
    ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [lastname, setLastname] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [phoneNumber, setPhoneNumber] = useState('');
    
    const { sendFirebaseOtp, checkAvailability, isLoading, error } = useAuthStore();
    const { colors } = useThemeStore();
    const navigation = useNavigation<any>();

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSignup = async () => {
        if (!username || !email || !password || !name || !lastname || !phoneNumber) {
            Alert.alert('Error', 'Please fill in all fields (including phone number)');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        // Store the registration data for later use in OTPScreen
        const registrationData = {
            username,
            email,
            password,
            name,
            lastname
        };

        // Combine country code and phone number
        let rawPhone = (countryCode + phoneNumber).trim().replace(/\s+/g, '');
        let formattedPhone = rawPhone;
        
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }

        const checkRes = await checkAvailability({ username, email, phone_number: formattedPhone });
        if (!checkRes.success) {
            Alert.alert('Registration Error', checkRes.error || 'Details already exist');
            return;
        }

        const success = await sendFirebaseOtp(formattedPhone);

        if (success) {
            navigation.navigate('OTP', { 
                phoneNumber: formattedPhone, 
                registrationData,
                isFirebase: true 
            });
        } else if (error) {
            Alert.alert('Verification Error', typeof error === 'string' ? error : 'Failed to send SMS');
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <TouchableOpacity 
                        style={styles.backButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View
                        style={[styles.logoContainer, { backgroundColor: colors.primary }]}
                    >
                        <Text style={styles.logo}>Odnix</Text>
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        Create Account
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Join the Odnix community
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Icon name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="Username"
                                placeholderTextColor={colors.textSecondary}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="Email"
                                placeholderTextColor={colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>

                        <View style={[styles.inputContainer, styles.phoneInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Icon name="call-outline" size={20} color={colors.textSecondary} style={styles.inputInnerIcon} />
                            <TextInput
                                style={[styles.countryCodeInput, { color: colors.text }]}
                                value={countryCode}
                                onChangeText={setCountryCode}
                                keyboardType="phone-pad"
                                maxLength={5}
                                editable={!isLoading}
                            />
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <TextInput
                                style={[styles.phoneInputField, { color: colors.text }]}
                                placeholder="Phone Number"
                                placeholderTextColor={colors.textSecondary}
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                keyboardType="phone-pad"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>
                        
                        <View style={styles.row}>
                            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.surface,
                                            color: colors.text,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="First Name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={name}
                                    onChangeText={setName}
                                    editable={!isLoading}
                                />
                            </View>
                            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: colors.surface,
                                            color: colors.text,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    placeholder="Last Name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={lastname}
                                    onChangeText={setLastname}
                                    editable={!isLoading}
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="Password"
                                placeholderTextColor={colors.textSecondary}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Icon name="shield-checkmark-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.surface,
                                        color: colors.text,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="Confirm Password"
                                placeholderTextColor={colors.textSecondary}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                editable={!isLoading}
                                onSubmitEditing={handleSignup}
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleSignup}
                            disabled={isLoading}
                            activeOpacity={0.8}
                        >
                            <View
                                style={[styles.button, { backgroundColor: colors.primary }]}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.buttonText}>Sign Up</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                            Already have an account?{' '}
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={[styles.footerLink, { color: colors.primary }]}>
                                Sign In
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 20,
        padding: 8,
        zIndex: 10,
    },
    logoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    logo: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 32,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    inputIcon: {
        position: 'absolute',
        left: 16,
        zIndex: 1,
    },
    inputInnerIcon: {
        marginLeft: 16,
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: 56,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingLeft: 48,
        fontSize: 16,
        borderWidth: 1,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 0,
        marginBottom: 16,
    },
    countryCodeInput: {
        width: 50,
        height: '100%',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
    },
    divider: {
        width: 1,
        height: '40%',
        marginHorizontal: 4,
    },
    phoneInputField: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 12,
        fontSize: 16,
    },
    row: {
        flexDirection: 'row',
        width: '100%',
    },
    button: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        marginTop: 32,
    },
    footerText: {
        fontSize: 14,
    },
    footerLink: {
        fontSize: 14,
        fontWeight: '700',
    },
});

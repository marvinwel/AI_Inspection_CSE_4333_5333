import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function ProfileScreen() {
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.avatar}>
                <Ionicons
                    name="person"
                    size={45}
                    color={colors.white}
                />
            </View>

            <Text style={styles.name}>
                Operator
            </Text>

            <Text style={styles.role}>
                Quality Control
            </Text>

            <View style={styles.card}>
                <Text style={styles.item}>
                    Mobile inspection account
                </Text>

                <Text style={styles.item}>
                    Camera permissions
                </Text>

                <Text style={styles.item}>
                    Notification settings
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.navy,
        alignItems: 'center',
        paddingTop: 70,
    },

    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: colors.purple,
        alignItems: 'center',
        justifyContent: 'center',
    },

    name: {
        color: colors.white,
        fontSize: 24,
        fontWeight: '900',
        marginTop: 14,
    },

    role: {
        color: '#B8C4D4',
        marginTop: 4,
    },

    card: {
        width: '90%',
        backgroundColor: colors.navy3,
        borderRadius: 14,
        padding: 18,
        marginTop: 26,
    },

    item: {
        color: colors.white,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#263C55',
    },
});

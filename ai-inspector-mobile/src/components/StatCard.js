import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function StatCard({ icon, value, label, accent = colors.purple, dark = false }) {
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={[styles.value, dark && styles.textWhite]}>{value}</Text>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderColor: colors.border },
  cardDark: { backgroundColor: colors.navy3, borderRadius: 12, marginHorizontal: 4, borderRightWidth: 0 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  value: { fontSize: 22, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, color: colors.text, marginTop: 2 },
  textWhite: { color: colors.white },
  labelDark: { color: '#D7DFEA' },
});

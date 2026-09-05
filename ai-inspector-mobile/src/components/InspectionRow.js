import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function InspectionRow({
  item,
  dark = false,
  onPress,
}) {
  const damaged =
    item.result?.toLowerCase() === 'damaged';

  const resultLabel = damaged ? 'Damaged' : 'Good';

  const imageSource = item.imageUri
    ? { uri: item.imageUri }
    : item.image;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        dark && styles.rowDark,
      ]}
    >
      {imageSource ? (
        <Image
          source={imageSource}
          style={styles.thumb}
        />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons
            name="cube-outline"
            size={25}
            color="#9CA3AF"
          />
        </View>
      )}

      <View style={styles.center}>
        <Text
          style={[
            styles.id,
            dark && styles.white,
          ]}
          numberOfLines={1}
        >
          {item.id}
        </Text>

        <Text
          style={[
            styles.date,
            dark && styles.mutedDark,
          ]}
        >
          {item.date}
        </Text>
      </View>

      <View style={styles.right}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: damaged
                ? colors.redSoft
                : colors.greenSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: damaged
                  ? colors.red
                  : colors.green,
              },
            ]}
          >
            {resultLabel}
          </Text>
        </View>

        <Text
          style={[
            styles.confidence,
            dark && styles.white,
          ]}
        >
          {item.confidence}%
        </Text>
      </View>

      {dark && (
        <Ionicons
          name="chevron-forward"
          size={17}
          color="#A9B4C5"
          style={styles.chevron}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },

  rowDark: {
    backgroundColor: colors.navy3,
    borderBottomWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 10,
    marginBottom: 9,
  },

  thumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },

  thumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: {
    flex: 1,
    marginLeft: 10,
  },

  id: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  date: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },

  right: {
    alignItems: 'flex-end',
  },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
  },

  badgeText: {
    fontWeight: '800',
    fontSize: 11,
  },

  confidence: {
    fontWeight: '800',
    marginTop: 6,
    color: colors.text,
  },

  white: {
    color: colors.white,
  },

  mutedDark: {
    color: '#B7C2D1',
  },

  chevron: {
    marginLeft: 8,
  },
});
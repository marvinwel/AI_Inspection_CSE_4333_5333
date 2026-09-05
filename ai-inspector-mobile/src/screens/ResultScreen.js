import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function ResultScreen({ navigation, route }) {
  const item = route.params?.inspection ?? {
    id: 'INS-10024',
    result: 'Good',
    confidence: 98,
    date: 'Aug 31, 9:28 AM',
    image: require('../../assets/box-ok.png'),
  };

  const damaged = item.result?.toLowerCase() === 'damaged';

  const imageSource = item.imageUri
    ? { uri: item.imageUri }
    : item.image;

  const accent = damaged ? colors.red : colors.green;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={colors.white}
          />
        </Pressable>

        <Text style={styles.topTitle}>
          Inspection Result
        </Text>

        <View style={{ width: 26 }} />
      </View>

      <View style={styles.card}>
        <View
          style={[
            styles.resultIcon,
            { backgroundColor: accent },
          ]}
        >
          <Ionicons
            name={damaged ? 'warning' : 'checkmark'}
            size={32}
            color={colors.white}
          />
        </View>

        <Text
          style={[
            styles.resultTitle,
            { color: accent },
          ]}
        >
          {damaged ? 'DAMAGED BOX' : 'GOOD BOX'}
        </Text>

        <Text style={styles.label}>
          Confidence
        </Text>

        <Text
          style={[
            styles.conf,
            { color: accent },
          ]}
        >
          {item.confidence}%
        </Text>

        <Text style={styles.id}>
          {item.id}
        </Text>

        <Text style={styles.date}>
          {item.date}
        </Text>

        <View style={styles.imageCard}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons
                name="image-outline"
                size={42}
                color="#9CA3AF"
              />

              <Text style={styles.noImageText}>
                Image unavailable
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.detailsTitle}>
          Details
        </Text>

        {[
          [
            'Result',
            damaged ? 'Damaged' : 'Good',
          ],
          [
            'Confidence',
            `${item.confidence}%`,
          ],
        ].map(([key, value]) => (
          <View
            key={key}
            style={styles.detailRow}
          >
            <Text style={styles.detailKey}>
              {key}
            </Text>

            <Text
              style={[
                styles.detailValue,
                { color: accent },
              ]}
            >
              {value}
            </Text>
          </View>
        ))}

        <View style={styles.actions}>
          <Pressable
            style={styles.outline}
            onPress={() =>
              navigation.navigate('History')
            }
          >
            <Text style={styles.outlineText}>
              View History
            </Text>
          </Pressable>

          <Pressable
            style={styles.done}
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'Home',
              })
            }
          >
            <Text style={styles.doneText}>
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingTop: 6,
  },

  top: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  topTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },

  card: {
    flex: 1,
    backgroundColor: colors.white,
    marginHorizontal: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 14,
    alignItems: 'center',
  },

  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 8,
  },

  label: {
    color: colors.text,
    marginTop: 7,
  },

  conf: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },

  id: {
    fontWeight: '800',
    fontSize: 15,
    marginTop: 12,
  },

  date: {
    color: '#374151',
    marginTop: 3,
  },

  imageCard: {
    width: '100%',
    height: 210,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginTop: 16,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noImageText: {
    marginTop: 8,
    color: '#9CA3AF',
  },

  detailsTitle: {
    width: '100%',
    fontWeight: '900',
    fontSize: 15,
    marginTop: 14,
    marginBottom: 8,
  },

  detailRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },

  detailKey: {
    color: colors.text,
  },

  detailValue: {
    fontWeight: '700',
  },

  actions: {
    marginTop: 'auto',
    marginBottom: 12,
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },

  outline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.purple,
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: 'center',
  },

  outlineText: {
    color: colors.purple,
    fontWeight: '800',
  },

  done: {
    flex: 1,
    backgroundColor: colors.purple,
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: 'center',
  },

  doneText: {
    color: colors.white,
    fontWeight: '800',
  },
});
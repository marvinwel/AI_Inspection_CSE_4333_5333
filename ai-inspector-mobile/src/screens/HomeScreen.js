import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import InspectionRow from '../components/InspectionRow';
import { fetchInspections } from '../services/inspectionService';

export default function HomeScreen({ navigation }) {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInspections = async () => {
    try {
      const data = await fetchInspections();

      const sorted = [...data].sort(
        (a, b) =>
          new Date(b.rawTimestamp ?? b.date) -
          new Date(a.rawTimestamp ?? a.date)
      );

      setInspections(sorted);
    } catch (error) {
      console.error('Home fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInspections();
  };

  const total = inspections.length;

  const goodCount = inspections.filter(
    (item) => item.result?.toLowerCase() === 'good'
  ).length;

  const damagedCount = inspections.filter(
    (item) => item.result?.toLowerCase() === 'damaged'
  ).length;

  const recentInspections = inspections.slice(0, 3);

  const today = new Date().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Ionicons
          name="menu"
          size={30}
          color={colors.white}
        />

        <Text style={styles.logo}>
          AI{' '}
          <Text style={styles.logoAccent}>
            INSPECTOR
          </Text>
        </Text>

        <View style={styles.bellWrap}>
          <Ionicons
            name="notifications"
            size={24}
            color={colors.white}
          />

          <View style={styles.dot} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
      >
        <Text style={styles.greeting}>
          Good morning,
        </Text>

        <Text style={styles.operator}>
          Operator
        </Text>

        <Text style={styles.sub}>
          Let's inspect and keep quality high.
        </Text>

        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.sectionTitle}>
              Today's Overview
            </Text>

            <Text style={styles.date}>
              {today}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator
                size="small"
                color={colors.purple}
              />
            </View>
          ) : (
            <View style={styles.statsRow}>
              <StatCard
                icon="cube"
                value={total.toString()}
                label="Inspected"
              />

              <StatCard
                icon="checkmark-circle"
                value={goodCount.toString()}
                label="Good"
                accent={colors.green}
              />

              <StatCard
                icon="alert-circle"
                value={damagedCount.toString()}
                label="Damaged"
                accent={colors.red}
              />
            </View>
          )}
        </View>

        <Pressable
          style={styles.newCard}
          onPress={() =>
            navigation.navigate('Inspect')
          }
        >
          <Text style={styles.newTitle}>
            New Inspection
          </Text>

          <Text style={styles.newSub}>
            Capture or upload an image
          </Text>

          <View style={styles.cameraCircle}>
            <Ionicons
              name="camera"
              size={34}
              color={colors.purple}
            />
          </View>

          <View style={styles.quickRow}>
            <View style={styles.quickItem}>
              <Ionicons
                name="camera-outline"
                size={18}
                color={colors.white}
              />
              <Text style={styles.quickText}>
                Camera
              </Text>
            </View>

            <View style={styles.quickItem}>
              <Ionicons
                name="image-outline"
                size={18}
                color={colors.white}
              />
              <Text style={styles.quickText}>
                Gallery
              </Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Recent Inspections
          </Text>

          <Pressable
            onPress={() =>
              navigation.navigate('History')
            }
          >
            <Text style={styles.link}>
              View all
            </Text>
          </Pressable>
        </View>

        <View style={styles.listCard}>
          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator
                size="small"
                color={colors.purple}
              />
            </View>
          ) : recentInspections.length > 0 ? (
            recentInspections.map((item) => (
              <InspectionRow
                key={item.id}
                item={item}
                onPress={() =>
                  navigation.navigate('Result', {
                    inspection: item,
                  })
                }
              />
            ))
          ) : (
            <Text style={styles.emptyText}>
              No inspections yet.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },

  header: {
    height: 88,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navy,
  },

  logo: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },

  logoAccent: {
    color: colors.purpleLight,
  },

  bellWrap: {
    position: 'relative',
  },

  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.red,
    position: 'absolute',
    right: -2,
    top: -2,
  },

  content: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 110,
  },

  greeting: {
    fontSize: 25,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },

  operator: {
    fontSize: 27,
    fontWeight: '900',
    color: colors.purple,
    marginTop: -2,
  },

  sub: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
    marginBottom: 16,
  },

  overviewCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  },

  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },

  date: {
    color: '#374151',
    fontSize: 12,
  },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
  },

  newCard: {
    backgroundColor: colors.purple,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 18,
  },

  newTitle: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 20,
  },

  newSub: {
    color: colors.white,
    marginTop: 3,
    marginBottom: 14,
  },

  cameraCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  quickRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  quickText: {
    color: colors.white,
    fontWeight: '600',
  },

  listCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 10,
  },

  link: {
    color: colors.purple,
    fontWeight: '700',
  },

  loadingArea: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
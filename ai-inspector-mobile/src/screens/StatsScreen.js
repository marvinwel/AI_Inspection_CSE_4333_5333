import React, {
  useCallback,
  useState,
} from 'react';

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import StatCard from '../components/StatCard';
import { fetchInspections } from '../services/inspectionService';

export default function StatsScreen() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadInspections = async () => {
    try {
      const data = await fetchInspections();
      setInspections(data);
    } catch (error) {
      console.error('Stats fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [])
  );

  // ------------------------------------------------
  // Get start of current week
  // Monday = first day
  // ------------------------------------------------

  const getStartOfWeek = () => {
    const now = new Date();

    const day = now.getDay();

    const difference =
      day === 0
        ? -6
        : 1 - day;

    const monday = new Date(now);

    monday.setDate(now.getDate() + difference);

    monday.setHours(0, 0, 0, 0);

    return monday;
  };

  const startOfWeek = getStartOfWeek();

  // ------------------------------------------------
  // Only inspections from this week
  // ------------------------------------------------

  const weeklyInspections = inspections.filter(
    (item) => {
      if (!item.rawTimestamp) {
        return false;
      }

      const inspectionDate =
        new Date(item.rawTimestamp);

      return inspectionDate >= startOfWeek;
    }
  );

  // ------------------------------------------------
  // Counts
  // ------------------------------------------------

  const total = weeklyInspections.length;

  const goodCount = weeklyInspections.filter(
    (item) =>
      item.result?.toLowerCase() === 'good'
  ).length;

  const damagedCount =
    weeklyInspections.filter(
      (item) =>
        item.result?.toLowerCase() ===
        'damaged'
    ).length;

  // ------------------------------------------------
  // Percentages
  // ------------------------------------------------

  const goodPercent =
    total > 0
      ? ((goodCount / total) * 100).toFixed(1)
      : '0.0';

  const damagedPercent =
    total > 0
      ? ((damagedCount / total) * 100).toFixed(1)
      : '0.0';

  // ------------------------------------------------
  // Daily counts
  // Monday → Sunday
  // ------------------------------------------------

  const days = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];

  const dailyData = days.map(
    (dayName, index) => {
      const dayStart =
        new Date(startOfWeek);

      dayStart.setDate(
        startOfWeek.getDate() + index
      );

      const dayEnd = new Date(dayStart);

      dayEnd.setDate(
        dayStart.getDate() + 1
      );

      const itemsForDay =
        weeklyInspections.filter(
          (item) => {
            const date =
              new Date(item.rawTimestamp);

            return (
              date >= dayStart &&
              date < dayEnd
            );
          }
        );

      const good =
        itemsForDay.filter(
          (item) =>
            item.result?.toLowerCase() ===
            'good'
        ).length;

      const damaged =
        itemsForDay.filter(
          (item) =>
            item.result?.toLowerCase() ===
            'damaged'
        ).length;

      return {
        day: dayName,
        good,
        damaged,
        total: good + damaged,
      };
    }
  );

  // ------------------------------------------------
  // Find largest day for bar scaling
  // ------------------------------------------------

  const maxDailyTotal = Math.max(
    ...dailyData.map(
      (item) => item.total
    ),
    1
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={colors.purpleLight}
          />

          <Text style={styles.loadingText}>
            Loading statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Statistics
        </Text>

        <Ionicons
          name="calendar-outline"
          size={21}
          color={colors.white}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
      >
        {/* Time period */}

        <View style={styles.select}>
          <Text style={styles.selectText}>
            This Week
          </Text>

          <Ionicons
            name="calendar-outline"
            size={18}
            color={colors.white}
          />
        </View>

        {/* Summary cards */}

        <View style={styles.cards}>
          <StatCard
            dark
            icon="cube"
            value={total.toString()}
            label="Inspected"
          />

          <StatCard
            dark
            icon="checkmark-circle"
            value={goodCount.toString()}
            label={`Good ${goodPercent}%`}
            accent={colors.green}
          />

          <StatCard
            dark
            icon="alert-circle"
            value={damagedCount.toString()}
            label={`Damaged ${damagedPercent}%`}
            accent={colors.red}
          />
        </View>

        {/* Daily trend */}

        <Text style={styles.sectionTitle}>
          Daily Trend
        </Text>

        <View style={styles.chart}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      colors.green,
                  },
                ]}
              />

              <Text style={styles.legendText}>
                Good
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      colors.red,
                  },
                ]}
              />

              <Text style={styles.legendText}>
                Damaged
              </Text>
            </View>
          </View>

          <View style={styles.bars}>
            {dailyData.map((item) => {
              const goodHeight =
                item.good > 0
                  ? (item.good /
                    maxDailyTotal) *
                  90
                  : 0;

              const damagedHeight =
                item.damaged > 0
                  ? (item.damaged /
                    maxDailyTotal) *
                  90
                  : 0;

              return (
                <View
                  key={item.day}
                  style={styles.barCol}
                >
                  <View
                    style={styles.barGroup}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height:
                            goodHeight,
                          backgroundColor:
                            colors.green,
                        },
                      ]}
                    />

                    <View
                      style={[
                        styles.bar,
                        {
                          height:
                            damagedHeight,
                          backgroundColor:
                            colors.red,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.day}>
                    {item.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Result breakdown */}

        <Text style={styles.sectionTitle}>
          Result Breakdown
        </Text>

        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Ionicons
                name="checkmark-circle"
                size={25}
                color={colors.green}
              />

              <Text style={styles.breakdownLabel}>
                Good
              </Text>
            </View>

            <View>
              <Text
                style={[
                  styles.breakdownValue,
                  {
                    color: colors.green,
                  },
                ]}
              >
                {goodCount}
              </Text>

              <Text
                style={
                  styles.breakdownPercent
                }
              >
                {goodPercent}%
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Ionicons
                name="alert-circle"
                size={25}
                color={colors.red}
              />

              <Text style={styles.breakdownLabel}>
                Damaged
              </Text>
            </View>

            <View>
              <Text
                style={[
                  styles.breakdownValue,
                  {
                    color: colors.red,
                  },
                ]}
              >
                {damagedCount}
              </Text>

              <Text
                style={
                  styles.breakdownPercent
                }
              >
                {damagedPercent}%
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingTop: 18,
  },

  header: {
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },

  content: {
    padding: 14,
    paddingBottom: 110,
  },

  select: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#2A3E56',
    borderRadius: 9,
    paddingHorizontal: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectText: {
    color: colors.white,
  },

  cards: {
    flexDirection: 'row',
    marginTop: 12,
  },

  sectionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 22,
    marginBottom: 10,
  },

  chart: {
    backgroundColor: colors.navy2,
    borderRadius: 12,
    padding: 12,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    color: colors.white,
    fontSize: 11,
  },

  bars: {
    height: 130,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 15,
  },

  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  barGroup: {
    height: 95,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },

  bar: {
    width: 7,
    borderRadius: 4,
    minHeight: 0,
  },

  day: {
    color: '#C3CDDA',
    fontSize: 10,
    marginTop: 6,
  },

  breakdownCard: {
    backgroundColor: colors.navy2,
    borderRadius: 12,
    padding: 16,
  },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  breakdownLabel: {
    color: colors.white,
    fontWeight: '700',
  },

  breakdownValue: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },

  breakdownPercent: {
    color: '#B7C2D1',
    fontSize: 11,
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: '#2A3E56',
    marginVertical: 14,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: colors.white,
    marginTop: 12,
  },
});
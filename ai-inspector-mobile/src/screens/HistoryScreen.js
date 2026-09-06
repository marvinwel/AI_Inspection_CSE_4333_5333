import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import InspectionRow from '../components/InspectionRow';
import { fetchInspections } from '../services/inspectionService';

export default function HistoryScreen({ navigation }) {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadInspections = async () => {
    try {
      setError('');

      const data = await fetchInspections();

      const sorted = [...data].sort(
        (a, b) => new Date(b.rawTimestamp ?? b.date) - new Date(a.rawTimestamp ?? a.date)
      );

      setInspections(sorted);
    } catch (e) {
      console.error('History fetch error:', e);
      setError('Unable to load inspection history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadInspections();
  };

  const visible = inspections.filter((item) => {
    const result = item.result?.toLowerCase();

    const matchesFilter =
      filter === 'All' ||
      (filter === 'Good' && result === 'good') ||
      (filter === 'Damaged' && result === 'damaged');

    const searchText = query.toLowerCase();

    const matchesSearch =
      item.id?.toLowerCase().includes(searchText) ||
      item.result?.toLowerCase().includes(searchText);

    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>History</Text>

      <View style={styles.search}>
        <Ionicons name="search" size={20} color="#C4CEDA" />
        <TextInput
          placeholder="Search by ID or result..."
          placeholderTextColor="#C4CEDA"
          value={query}
          onChangeText={setQuery}
          style={styles.input}
        />
        <Ionicons name="filter" size={20} color={colors.white} />
      </View>

      <View style={styles.filters}>
        {['All', 'Good', 'Damaged'].map((f) => (
          <Pressable
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.purpleLight} />
          <Text style={styles.loadingText}>Loading inspections...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.white} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadInspections}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {visible.length > 0 ? (
            visible.map((item) => (
              <InspectionRow
                key={item.id}
                item={item}
                dark
                onPress={() =>
                  navigation.getParent()?.navigate('Result', {
                    inspection: item,
                  })
                }
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No inspections found.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  title: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 18,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy3,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    color: colors.white,
  },
  filters: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.navy3,
    borderRadius: 18,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.purple,
  },
  pillText: {
    color: '#D5DDE8',
  },
  pillTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  list: {
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.white,
    marginTop: 12,
  },
  errorText: {
    color: colors.white,
    marginTop: 10,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: colors.purple,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
  emptyText: {
    color: '#C4CEDA',
    textAlign: 'center',
    marginTop: 40,
  },
});

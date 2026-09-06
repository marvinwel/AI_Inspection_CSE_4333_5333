import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { submitInspection } from '../services/inspectionService';

export default function CameraScreen({ navigation }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState('off');
  const [facing, setFacing] = useState('back');

  useEffect(() => { if (permission && !permission.granted) requestPermission(); }, [permission]);

  const capture = async () => {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    setPhoto(result.uri);
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });

      if (result.canceled) return;

      const selectedUri = result.assets[0].uri;

      const converted = await ImageManipulator.manipulateAsync(
        selectedUri,
        [
          {
            resize: {
              width: 1280,
            },
          },
        ],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      setPhoto(converted.uri);
    } catch (error) {
      console.error('Gallery error:', error);
      alert(`Unable to load image: ${error.message}`);
    }
  };

  const analyze = async () => {
    if (!photo) return;

    try {
      setLoading(true);

      const inspection = await submitInspection(photo);

      navigation.getParent()?.navigate('Result', {
        inspection,
      });
    } catch (error) {
      console.error('Inspection error:', error);

      alert(
        `Inspection failed: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!permission.granted) {
    return <View style={styles.center}><Text>Camera permission is required.</Text><Pressable style={styles.permissionBtn} onPress={requestPermission}><Text style={styles.permissionText}>Grant Permission</Text></Pressable></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}><Pressable onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={28} color={colors.white} /></Pressable><Text style={styles.title}>New Inspection</Text><View style={{ width: 28 }} /></View>
      <View style={styles.cameraWrap}>
        {photo ? <Image source={{ uri: photo }} style={styles.camera} /> : <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flash} />}
        <View style={styles.hint}><Text style={styles.hintText}>Center the box{`\n`}in the frame</Text></View>
        <View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} /><View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} />
        {!photo && <View style={styles.floatRow}><Pressable style={styles.floatBtn} onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}><Ionicons name="flash" size={26} color={colors.white} /></Pressable><Pressable style={styles.floatBtn} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}><Ionicons name="sync" size={24} color={colors.white} /></Pressable></View>}
      </View>
      <View style={styles.controls}>
        {photo ? (
          <View style={styles.previewActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => setPhoto(null)}><Text style={styles.secondaryText}>Retake</Text></Pressable>
            <Pressable style={styles.primaryBtn} onPress={analyze} disabled={loading}>{loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Analyze</Text>}</Pressable>
          </View>
        ) : (
          <View style={styles.captureRow}>
            <Pressable onPress={pickFromGallery}><Ionicons name="image-outline" size={30} color={colors.white} /></Pressable>
            <Pressable style={styles.shutterOuter} onPress={capture}><View style={styles.shutterInner} /></Pressable>
            <Text style={styles.auto}>Auto ›</Text>
          </View>
        )}
        <View style={styles.tips}><Text style={styles.tipsTitle}>Tips for best results</Text><Text style={styles.tip}>•  Good lighting</Text><Text style={styles.tip}>•  Clear focus</Text><Text style={styles.tip}>•  Single box in frame</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy }, topBar: { paddingTop: 52, height: 100, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.white, fontSize: 17, fontWeight: '800' },
  cameraWrap: { height: '55%', position: 'relative', overflow: 'hidden' }, camera: { width: '100%', height: '100%' }, hint: { position: 'absolute', top: 18, alignSelf: 'center', backgroundColor: '#000000AA', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }, hintText: { color: colors.white, textAlign: 'center' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.white }, tl: { top: 95, left: 28, borderLeftWidth: 3, borderTopWidth: 3 }, tr: { top: 95, right: 28, borderRightWidth: 3, borderTopWidth: 3 }, bl: { bottom: 95, left: 28, borderLeftWidth: 3, borderBottomWidth: 3 }, br: { bottom: 95, right: 28, borderRightWidth: 3, borderBottomWidth: 3 },
  floatRow: { position: 'absolute', bottom: 14, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }, floatBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#041127CC', alignItems: 'center', justifyContent: 'center' },
  controls: { flex: 1, paddingHorizontal: 20, paddingTop: 16 }, captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }, shutterOuter: { width: 78, height: 78, borderRadius: 39, borderWidth: 3, borderColor: colors.purpleLight, alignItems: 'center', justifyContent: 'center' }, shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white }, auto: { color: colors.white, fontWeight: '700', fontSize: 16 },
  tips: { marginTop: 16, backgroundColor: colors.navy3, borderRadius: 12, padding: 16 }, tipsTitle: { color: colors.purpleLight, fontWeight: '700', marginBottom: 8 }, tip: { color: colors.white, marginVertical: 4 },
  previewActions: { flexDirection: 'row', gap: 12 }, primaryBtn: { flex: 1, backgroundColor: colors.purple, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }, secondaryBtn: { flex: 1, borderColor: colors.purpleLight, borderWidth: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '800' }, secondaryText: { color: colors.purpleLight, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }, permissionBtn: { marginTop: 12, padding: 12, backgroundColor: colors.purple, borderRadius: 8 }, permissionText: { color: colors.white, fontWeight: '700' },
});

import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../utils/constants';

// Full-screen popup showing a tenant's profile photo large, with a close cross.
// Tapping the dimmed backdrop also closes it.
export default function ProfileImagePopup({ visible, imageUrl, name, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.inner} onPress={() => {}}>
          <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
            <Icon name="close" size={22} color="#fff" />
          </Pressable>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.fallback]}>
              <Text style={styles.fallbackText}>{name?.[0]?.toUpperCase() || 'T'}</Text>
            </View>
          )}
          {name ? <Text style={styles.name}>{name}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const SIZE = 280;

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)', padding: 24 },
  inner: { alignItems: 'center', gap: 16 },
  close: { position: 'absolute', top: -14, right: -14, zIndex: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  image: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontSize: 96, fontWeight: '900' },
  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

import { useMemo } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { radii, spacing, useTheme } from '../constants/theme.js'

// Shared bottom sheet (design doc 4.1). Modal-based, no shadows, top radii
// capped at 8px.
export function Sheet({ visible, onClose, title, children }) {
  const colors = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end'
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      padding: spacing.lg,
      maxHeight: '85%'
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md
    },
    title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
    close: { fontSize: 14, color: colors.primary }
  })

export function createFieldStyles(colors) {
  return StyleSheet.create({
    label: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      backgroundColor: colors.surface
    },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface
    },
    chipActive: { borderColor: colors.primary },
    chipText: { fontSize: 12, color: colors.textSecondary },
    chipTextActive: { color: colors.primary, fontWeight: '600' },
    submit: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: spacing.lg
    },
    submitText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
    error: { color: colors.warningRed, fontSize: 12, marginTop: 8 }
  })
}